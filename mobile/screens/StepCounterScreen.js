import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  AppState,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import healthConnectManager, {
  getActivityData,
  requestAllHealthPermissions,
  openHealthConnectSettingsPage,
} from '../services/healthConnectService';
import stepDetectionService from '../services/stepDetectionService';
import api from '../services/api';

const { width } = Dimensions.get('window');

const StepCounterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [phoneSensorSteps, setPhoneSensorSteps] = useState(0);
  const [lastSyncedSteps, setLastSyncedSteps] = useState(0);
  const [lastWrittenToHealthConnect, setLastWrittenToHealthConnect] = useState(0);
  const [activityData, setActivityData] = useState({
    steps: 0,
    distance: 0,
    activeCalories: 0,
    totalCalories: 0,
    exerciseSessions: [],
    dailyData: [],
  });
  const [hasPermissions, setHasPermissions] = useState(false);

  // Refs for intervals and timers
  const syncIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastAutoSyncRef = useRef(Date.now());

  const periods = [
    { id: 'today', label: 'Today', icon: 'calendar-today' },
    { id: 'week', label: 'Week', icon: 'calendar-week' },
    { id: 'month', label: 'Month', icon: 'calendar-month' },
  ];

  // Initialize services
  useEffect(() => {
    initializeServices();
    
    return () => {
      // Cleanup on unmount
      stepDetectionService.stop();
      
      // Clear sync interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  // Reload data when period changes
  useEffect(() => {
    if (selectedPeriod === 'today') {
      updateTodaySteps();
    } else if (hasPermissions) {
      loadActivityData();
    }
  }, [selectedPeriod, hasPermissions, phoneSensorSteps]);

  // Auto-sync based on step milestones (every 50 steps)
  useEffect(() => {
    if (selectedPeriod === 'today' && phoneSensorSteps > 0) {
      const stepDifference = phoneSensorSteps - lastSyncedSteps;
      
      // Sync every 50 steps
      if (stepDifference >= 50) {
        console.log(`🎯 Step milestone reached: ${phoneSensorSteps} steps (${stepDifference} new) - auto-syncing...`);
        performAutoSync();
      }
    }
  }, [phoneSensorSteps, selectedPeriod, lastSyncedSteps]);

  // Periodic auto-sync (every 5 minutes)
  useEffect(() => {
    if (selectedPeriod === 'today') {
      // Clear existing interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      // Set up new interval for periodic sync
      syncIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceLastSync = now - lastAutoSyncRef.current;
        
        // Only sync if it's been more than 5 minutes since last sync
        if (timeSinceLastSync >= 5 * 60 * 1000) {
          console.log('⏰ Periodic auto-sync (5 minutes)...');
          performAutoSync();
        }
      }, 5 * 60 * 1000); // Check every 5 minutes

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [selectedPeriod]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // App is coming to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App came to foreground - syncing data...');
        updateTodaySteps();
        performAutoSync();
      }
      
      // App is going to background
      if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('📱 App going to background - saving data...');
        performAutoSync();
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Auto-sync when leaving the screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      console.log('👋 Leaving screen - performing final sync...');
      performAutoSync();
    });

    return unsubscribe;
  }, [navigation]);

  // Perform auto-sync
  const performAutoSync = useCallback(async () => {
    if (isSyncing || selectedPeriod !== 'today') {
      return;
    }

    try {
      await updateTodaySteps();
      await syncActivityToBackend(true); // Pass true for silent sync
      setLastSyncedSteps(phoneSensorSteps);
      lastAutoSyncRef.current = Date.now();
    } catch (error) {
      console.error('❌ Auto-sync error:', error);
    }
  }, [isSyncing, selectedPeriod, phoneSensorSteps]);

  // Initialize all services
  const initializeServices = useCallback(async () => {
    try {
      console.log('🔧 Initializing services...');
      
      // Initialize step detection (always enabled)
      await stepDetectionService.initialize();
      stepDetectionService.start();
      
      // Listen for step updates
      const unsubscribe = stepDetectionService.addListener((steps) => {
        setPhoneSensorSteps(steps);
      });
      
      // Load current count
      const currentSteps = stepDetectionService.getStepCount();
      setPhoneSensorSteps(currentSteps);
      setLastSyncedSteps(currentSteps);
      
      console.log('✅ Phone sensor started with', currentSteps, 'steps');
      
      // Initialize Health Connect (ALWAYS initialize for reading/writing)
      await healthConnectManager.initialize();
      const permissionsGranted = await requestAllHealthPermissions();
      
      setHasPermissions(permissionsGranted);
      
      if (permissionsGranted) {
        console.log('✅ Health Connect permissions granted');
        // Load last written count
        const lastWritten = await loadLastWrittenSteps();
        setLastWrittenToHealthConnect(lastWritten);
      } else {
        console.log('⚠️ Health Connect permissions denied, using phone sensor only');
      }

      // Initial data load and sync
      await updateTodaySteps();
      await performAutoSync();
      
    } catch (error) {
      console.error('❌ Initialization error:', error);
      toast.error('Failed to initialize step tracking');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Update today's steps (READ from Health Connect for unified view)
  const updateTodaySteps = useCallback(async () => {
    try {
      let totalSteps = 0;
      let distance = 0;
      let calories = 0;
      
      if (hasPermissions) {
        // Read ALL steps from Health Connect (including our written steps)
        const { startDate, endDate } = getDateRange('today');
        const healthData = await getActivityData(startDate, endDate);
        
        totalSteps = calculateTotalSteps(healthData.steps);
        distance = calculateTotalDistance(healthData.distance);
        calories = calculateTotalCalories(healthData.totalCalories);
        
        console.log(`📊 Health Connect: ${totalSteps} steps (includes all sources)`);
      } else {
        // Fallback: Use phone sensor only if no Health Connect access
        totalSteps = phoneSensorSteps;
        distance = stepDetectionService.calculateDistance(phoneSensorSteps);
        calories = stepDetectionService.calculateCalories(phoneSensorSteps);
        
        console.log(`📱 Phone sensor only: ${totalSteps} steps`);
      }
      
      setActivityData({
        steps: totalSteps,
        distance: distance,
        activeCalories: calories * 0.7,
        totalCalories: calories,
        exerciseSessions: [],
        dailyData: [],
      });
      
    } catch (error) {
      console.error('❌ Update error:', error);
    }
  }, [phoneSensorSteps, hasPermissions]);

  // Group data by day for week/month view
  const groupDataByDay = (stepsData, distanceData, caloriesData) => {
    const dayMap = new Map();
    
    // Process steps
    stepsData?.forEach(record => {
      const date = new Date(record.startTime || record.time).toDateString();
      if (!dayMap.has(date)) {
        dayMap.set(date, { date, steps: 0, distance: 0, calories: 0 });
      }
      dayMap.get(date).steps += Number(record?.count || 0);
    });
    
    // Process distance
    distanceData?.forEach(record => {
      const date = new Date(record.startTime || record.time).toDateString();
      if (!dayMap.has(date)) {
        dayMap.set(date, { date, steps: 0, distance: 0, calories: 0 });
      }
      dayMap.get(date).distance += Number(record?.distance?.inMeters || 0);
    });
    
    // Process calories
    caloriesData?.forEach(record => {
      const date = new Date(record.startTime || record.time).toDateString();
      if (!dayMap.has(date)) {
        dayMap.set(date, { date, steps: 0, distance: 0, calories: 0 });
      }
      dayMap.get(date).calories += Number(record?.energy?.inKilocalories || 0);
    });
    
    return Array.from(dayMap.values()).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
  };

  // Load activity data (for week/month view)
  const loadActivityData = useCallback(async () => {
    try {
      console.log(`📊 Loading data for: ${selectedPeriod}`);
      
      if (!hasPermissions) {
        // If no Health Connect permissions, show empty data
        setActivityData({
          steps: phoneSensorSteps,
          distance: stepDetectionService.calculateDistance(phoneSensorSteps),
          activeCalories: stepDetectionService.calculateCalories(phoneSensorSteps) * 0.7,
          totalCalories: stepDetectionService.calculateCalories(phoneSensorSteps),
          exerciseSessions: [],
          dailyData: [],
        });
        return;
      }
      
      const { startDate, endDate } = getDateRange(selectedPeriod);
      const data = await getActivityData(startDate, endDate);
      
      console.log('📊 Raw data:', data);
      
      // Calculate totals
      const totalSteps = calculateTotalSteps(data.steps);
      const totalDistance = calculateTotalDistance(data.distance);
      const totalActiveCalories = calculateTotalCalories(data.activeCalories);
      const totalCalories = calculateTotalCalories(data.totalCalories);
      
      // Group by day for week/month view
      const dailyData = selectedPeriod !== 'today' 
        ? groupDataByDay(data.steps, data.distance, data.totalCalories)
        : [];
      
      const processedData = {
        steps: totalSteps,
        distance: totalDistance,
        activeCalories: totalActiveCalories,
        totalCalories: totalCalories,
        exerciseSessions: data.exerciseSessions || [],
        dailyData,
      };
      
      setActivityData(processedData);
      console.log('✅ Data processed:', processedData);
      
    } catch (error) {
      console.error('❌ Load error:', error);
      toast.error('Failed to load activity data');
    }
  }, [selectedPeriod, toast, phoneSensorSteps, hasPermissions]);

  // Write phone sensor steps to Health Connect
  const writeStepsToHealthConnect = useCallback(async (stepCount) => {
    if (!hasPermissions || stepCount <= 0) {
      return;
    }

    try {
      const { insertSteps } = require('../services/healthConnectService');
      
      const now = new Date();
      const startTime = new Date(now.getTime() - (5 * 60 * 1000)); // 5 minutes ago
      
      const result = await insertSteps({
        count: stepCount,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      });
      
      if (result.success) {
        setLastWrittenToHealthConnect(phoneSensorSteps);
        await saveLastWrittenSteps(phoneSensorSteps);
        console.log(`✅ Wrote ${stepCount} steps to Health Connect`);
        
        // Refresh to show combined data
        await updateTodaySteps();
      } else {
        console.error('❌ Failed to write to Health Connect:', result);
      }
    } catch (error) {
      console.error('❌ Write to Health Connect error:', error);
    }
  }, [hasPermissions, phoneSensorSteps]);

  // Save last written steps count
  const saveLastWrittenSteps = async (steps) => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('last_written_steps', steps.toString());
    } catch (error) {
      console.error('❌ Failed to save last written steps:', error);
    }
  };

  // Load last written steps count
  const loadLastWrittenSteps = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const value = await AsyncStorage.getItem('last_written_steps');
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error('❌ Failed to load last written steps:', error);
      return 0;
    }
  };

  // Sync to backend (use Health Connect data as source of truth)
  const syncActivityToBackend = useCallback(async (silent = false) => {
    if (isSyncing || selectedPeriod !== 'today') {
      console.log('⏭️ Skipping sync:', { isSyncing, selectedPeriod });
      return;
    }

    try {
      setIsSyncing(true);
      if (!silent) {
        console.log('📤 Syncing to backend...');
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Use Health Connect data if available (already deduplicated)
      // Otherwise use phone sensor data
      const dataToSync = {
        date: today.toISOString(),
        steps: activityData.steps, // Health Connect total (deduplicated)
        distance: activityData.distance,
        activeCalories: activityData.activeCalories,
        totalCalories: activityData.totalCalories,
        source: hasPermissions ? 'health_connect' : 'phone_sensor',
        phoneSensorSteps: phoneSensorSteps,
        healthConnectSteps: hasPermissions ? activityData.steps : 0,
      };
      
      if (!silent) {
        console.log('📤 Data to sync:', dataToSync);
      }
      
      const response = await api.saveDailyActivity(dataToSync);
      
      if (response.success) {
        if (!silent) {
          console.log('✅ Sync successful');
          toast.success('Activity synced successfully');
        } else {
          console.log('✅ Auto-sync successful');
        }
      } else {
        console.error('❌ Sync failed:', response);
        if (!silent) {
          toast.error('Failed to sync activity data');
        }
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      if (!silent) {
        toast.error('Sync failed: ' + error.message);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, selectedPeriod, phoneSensorSteps, activityData, hasPermissions, toast]);

  // Get date range
  const getDateRange = (period) => {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  };

  // Calculate total steps
  const calculateTotalSteps = (stepsData) => {
    if (!Array.isArray(stepsData) || stepsData.length === 0) return 0;
    return stepsData.reduce((total, record) => {
      const count = Number(record?.count || 0);
      return total + count;
    }, 0);
  };

  // Calculate total distance
  const calculateTotalDistance = (distanceData) => {
    if (!Array.isArray(distanceData) || distanceData.length === 0) return 0;
    return distanceData.reduce((total, record) => {
      const distance = Number(record?.distance?.inMeters || 0);
      return total + distance;
    }, 0);
  };

  // Calculate total calories
  const calculateTotalCalories = (caloriesData) => {
    if (!Array.isArray(caloriesData) || caloriesData.length === 0) return 0;
    return caloriesData.reduce((total, record) => {
      const calories = Number(record?.energy?.inKilocalories || 0);
      return total + calories;
    }, 0);
  };

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (selectedPeriod === 'today') {
        await updateTodaySteps();
        await performAutoSync();
      } else {
        await loadActivityData();
      }
      toast.success('Data refreshed');
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadActivityData, updateTodaySteps, selectedPeriod, performAutoSync, toast]);

  // Format distance
  const formatDistance = (meters) => {
    const m = Number(meters) || 0;
    if (m < 1000) {
      return `${Math.round(m)} m`;
    }
    return `${(m / 1000).toFixed(2)} km`;
  };

  // Calculate step goal progress
  const getStepGoalProgress = () => {
    const dailyGoal = 10000;
    const steps = Number(activityData.steps) || 0;
    const progress = (steps / dailyGoal) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  // Get average for period
  const getAverageSteps = () => {
    const days = selectedPeriod === 'week' ? 7 : 30;
    return Math.round(activityData.steps / days);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  // Get max steps for chart scaling
  const getMaxSteps = () => {
    if (activityData.dailyData.length === 0) return 10000;
    return Math.max(...activityData.dailyData.map(d => d.steps), 10000);
  };

  // Request permissions
  const handleRequestPermissions = useCallback(async () => {
    try {
      const granted = await requestAllHealthPermissions();
      if (granted) {
        setHasPermissions(true);
        toast.success('Permissions granted');
        await loadActivityData();
      } else {
        toast.error('Permissions denied');
      }
    } catch (error) {
      console.error('Permission error:', error);
      toast.error('Failed to request permissions');
    }
  }, [loadActivityData, toast]);

  // Open settings
  const handleOpenSettings = useCallback(async () => {
    try {
      await openHealthConnectSettingsPage();
    } catch (error) {
      console.error('Settings error:', error);
      toast.error('Failed to open settings');
    }
  }, [toast]);

  // Manual sync handler (keeping for manual refresh button)
  const handleManualSync = useCallback(async () => {
    if (selectedPeriod !== 'today') {
      toast.info('Switch to "Today" to sync data');
      return;
    }
    
    await updateTodaySteps();
    await syncActivityToBackend(false); // Manual sync with toast
  }, [selectedPeriod, updateTodaySteps, syncActivityToBackend, toast]);

  // Render steps badge showing breakdown
  const renderStepsBadge = () => {
    if (selectedPeriod !== 'today') return null;
    
    if (hasPermissions) {
      const otherAppsSteps = activityData.steps - phoneSensorSteps;
      
      return (
        <>
          <View style={styles.sensorBadge}>
            <Icon name="cellphone" size={14} color={colors.primary} />
            <Text style={styles.sensorBadgeText}>
              {phoneSensorSteps.toLocaleString()} from this app
            </Text>
          </View>
          {otherAppsSteps > 0 && (
            <View style={[styles.sensorBadge, { marginTop: 4, backgroundColor: '#4CAF5015' }]}>
              <Icon name="google-fit" size={14} color="#4CAF50" />
              <Text style={[styles.sensorBadgeText, { color: '#4CAF50' }]}>
                {otherAppsSteps.toLocaleString()} from other apps
              </Text>
            </View>
          )}
        </>
      );
    }
    
    return (
      <View style={styles.sensorBadge}>
        <Icon name="cellphone" size={14} color={colors.primary} />
        <Text style={styles.sensorBadgeText}>
          {phoneSensorSteps.toLocaleString()} steps detected
        </Text>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingsButton: {
      padding: 8,
      marginLeft: 4,
    },
    periodSelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    periodButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginHorizontal: 4,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 6,
    },
    periodButtonTextActive: {
      color: 'white',
    },
    scrollContent: {
      padding: 16,
    },
    mainStatsCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    stepsContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    stepsIcon: {
      marginBottom: 16,
    },
    stepsCount: {
      fontSize: 56,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
    },
    stepsLabel: {
      fontSize: 16,
      color: colors.secondary,
      fontWeight: '500',
    },
    sensorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginTop: 8,
    },
    sensorBadgeText: {
      fontSize: 12,
      color: colors.primary,
      marginLeft: 6,
      fontWeight: '500',
    },
    averageContainer: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    averageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    averageLabel: {
      fontSize: 16,
      color: colors.secondary,
      fontWeight: '500',
    },
    averageValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
    },
    goalProgress: {
      marginTop: 16,
    },
    goalProgressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    goalProgressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    goalText: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    },
    metricCard: {
      width: (width - 48) / 2,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      margin: 8,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    metricIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    metricValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    metricLabel: {
      fontSize: 14,
      color: colors.secondary,
      fontWeight: '500',
    },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    chartContainer: {
      height: 200,
    },
    chartBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 160,
      paddingHorizontal: 8,
    },
    chartBar: {
      flex: 1,
      marginHorizontal: 2,
      backgroundColor: colors.primary,
      borderRadius: 4,
      minHeight: 2,
      opacity: 0.8,
    },
    chartLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingHorizontal: 8,
    },
    chartLabel: {
      fontSize: 10,
      color: colors.secondary,
      flex: 1,
      textAlign: 'center',
    },
    dailyBreakdownSection: {
      marginTop: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    dailyCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dailyCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    dailyDate: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    dailySteps: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
    },
    dailyMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    dailyMetric: {
      alignItems: 'center',
    },
    dailyMetricValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    dailyMetricLabel: {
      fontSize: 12,
      color: colors.secondary,
    },
    sessionsSection: {
      marginTop: 16,
    },
    sessionCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sessionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    sessionInfo: {
      flex: 1,
    },
    sessionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    sessionDetails: {
      fontSize: 14,
      color: colors.secondary,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      minHeight: 200,
    },
    emptyText: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginTop: 16,
    },
    permissionsContainer: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      margin: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    permissionsTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    permissionsText: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    permissionsButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 32,
      width: '100%',
    },
    permissionsButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    settingsLinkButton: {
      marginTop: 12,
      paddingVertical: 12,
    },
    settingsLinkText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });

  // Render chart for week/month view
  const renderChart = () => {
    if (selectedPeriod === 'today' || activityData.dailyData.length === 0) return null;

    const maxSteps = getMaxSteps();
    const displayData = activityData.dailyData.slice(0, selectedPeriod === 'week' ? 7 : 14);

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Steps Overview</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {displayData.map((day, index) => {
              const height = (day.steps / maxSteps) * 160;
              return (
                <View
                  key={`bar-${index}`}
                  style={[
                    styles.chartBar,
                    { 
                      height: Math.max(height, 2),
                      opacity: day.steps > 0 ? 0.8 : 0.3,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.chartLabels}>
            {displayData.map((day, index) => (
              <Text key={`label-${index}`} style={styles.chartLabel}>
                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })[0]}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Render daily breakdown for week/month
  const renderDailyBreakdown = () => {
    if (selectedPeriod === 'today' || activityData.dailyData.length === 0) return null;

    return (
      <View style={styles.dailyBreakdownSection}>
        <Text style={styles.sectionTitle}>Daily Breakdown</Text>
        {activityData.dailyData.slice(0, 7).map((day, index) => (
          <View key={`day-${index}`} style={styles.dailyCard}>
            <View style={styles.dailyCardHeader}>
              <Text style={styles.dailyDate}>{formatDate(day.date)}</Text>
              <Text style={styles.dailySteps}>
                {day.steps.toLocaleString()} steps
              </Text>
            </View>
            <View style={styles.dailyMetrics}>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>
                  {formatDistance(day.distance)}
                </Text>
                <Text style={styles.dailyMetricLabel}>Distance</Text>
              </View>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>
                  {Math.round(day.calories)}
                </Text>
                <Text style={styles.dailyMetricLabel}>Calories</Text>
              </View>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>
                  {Math.round((day.steps / 10000) * 100)}%
                </Text>
                <Text style={styles.dailyMetricLabel}>Goal</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Step Counter</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>Initializing step tracking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step Counter</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={handleManualSync}
              disabled={isSyncing}
            >
              <Icon 
                name={isSyncing ? "sync" : "cloud-upload"} 
                size={24} 
                color={isSyncing ? colors.secondary : colors.text} 
              />
            </TouchableOpacity>
            {hasPermissions && (
              <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings}>
                <Icon name="cog" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Period selector */}
        <View style={styles.periodSelector}>
          {periods.map(period => (
            <TouchableOpacity
              key={period.id}
              style={[
                styles.periodButton,
                selectedPeriod === period.id && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period.id)}
            >
              <Icon
                name={period.icon}
                size={18}
                color={selectedPeriod === period.id ? 'white' : colors.text}
              />
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period.id && styles.periodButtonTextActive,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Main steps card */}
        <View style={styles.mainStatsCard}>
          <View style={styles.stepsContainer}>
            <View style={styles.stepsIcon}>
              <Icon name="walk" size={64} color={colors.primary} />
            </View>
            <Text style={styles.stepsCount}>
              {activityData.steps.toLocaleString()}
            </Text>
            <Text style={styles.stepsLabel}>
              {selectedPeriod === 'today' ? 'Steps Today' : 'Total Steps'}
            </Text>
            {renderStepsBadge()}
          </View>

          {/* Goal progress for today */}
          {selectedPeriod === 'today' && (
            <View style={styles.goalProgress}>
              <View style={styles.goalProgressBar}>
                <View
                  style={[
                    styles.goalProgressFill,
                    { width: `${getStepGoalProgress()}%` },
                  ]}
                />
              </View>
              <Text style={styles.goalText}>
                {getStepGoalProgress().toFixed(0)}% of daily goal (10,000 steps)
              </Text>
            </View>
          )}

          {/* Average for week/month */}
          {selectedPeriod !== 'today' && (
            <View style={styles.averageContainer}>
              <View style={styles.averageRow}>
                <Text style={styles.averageLabel}>Daily Average</Text>
                <Text style={styles.averageValue}>
                  {getAverageSteps().toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Chart for week/month */}
        {renderChart()}

        {/* Activity metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconContainer, { backgroundColor: '#3498DB15' }]}>
              <Icon name="map-marker-distance" size={24} color="#3498DB" />
            </View>
            <Text style={styles.metricValue}>
              {formatDistance(activityData.distance)}
            </Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconContainer, { backgroundColor: '#E74C3C15' }]}>
              <Icon name="fire" size={24} color="#E74C3C" />
            </View>
            <Text style={styles.metricValue}>
              {Math.round(activityData.activeCalories)}
            </Text>
            <Text style={styles.metricLabel}>Active Cal</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconContainer, { backgroundColor: '#F39C1215' }]}>
              <Icon name="flash" size={24} color="#F39C12" />
            </View>
            <Text style={styles.metricValue}>
              {Math.round(activityData.totalCalories)}
            </Text>
            <Text style={styles.metricLabel}>Total Cal</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconContainer, { backgroundColor: '#27AE6015' }]}>
              <Icon name="dumbbell" size={24} color="#27AE60" />
            </View>
            <Text style={styles.metricValue}>
              {activityData.exerciseSessions.length}
            </Text>
            <Text style={styles.metricLabel}>Workouts</Text>
          </View>
        </View>

        {/* Daily breakdown for week/month */}
        {renderDailyBreakdown()}

        {/* Exercise sessions for today */}
        {selectedPeriod === 'today' && activityData.exerciseSessions.length > 0 && (
          <View style={styles.sessionsSection}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            {activityData.exerciseSessions.slice(0, 5).map((session, index) => (
              <View key={`session-${index}`} style={styles.sessionCard}>
                <View style={[styles.sessionIcon, { backgroundColor: '#27AE6015' }]}>
                  <Icon name="run" size={24} color="#27AE60" />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle}>
                    {session.exerciseType || 'Exercise'}
                  </Text>
                  <Text style={styles.sessionDetails}>
                    {session.duration ? `${Math.round(session.duration / 60)} min` : 'N/A'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {activityData.steps === 0 && !isRefreshing && (
          <View style={styles.centerContainer}>
            <Icon name="information-outline" size={64} color={colors.secondary} />
            <Text style={styles.emptyText}>
              No activity data found for this period.{'\n'}
              Start moving to see your stats!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StepCounterScreen;