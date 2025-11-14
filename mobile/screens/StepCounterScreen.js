import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import healthConnectManager, {
  getActivityData,
  requestAllHealthPermissions,
  openHealthConnectSettingsPage,
} from '../services/healthConnectService';
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
  const [activityData, setActivityData] = useState({
    steps: 0,
    distance: 0,
    activeCalories: 0,
    totalCalories: 0,
    exerciseSessions: [],
    dailyData: [], // For week/month breakdown
  });
  const [hasPermissions, setHasPermissions] = useState(false);

  const periods = [
    { id: 'today', label: 'Today', icon: 'calendar-today' },
    { id: 'week', label: 'Week', icon: 'calendar-week' },
    { id: 'month', label: 'Month', icon: 'calendar-month' },
  ];

  // Initialize Health Connect
  useEffect(() => {
    initializeHealthConnect();
  }, []);

  // Reload data when period changes
  useEffect(() => {
    if (hasPermissions) {
      loadActivityData();
    }
  }, [selectedPeriod, hasPermissions]);

  // Initialize Health Connect
  const initializeHealthConnect = useCallback(async () => {
    try {
      console.log('🔧 Initializing Health Connect...');
      
      await healthConnectManager.initialize();
      const permissionsGranted = await requestAllHealthPermissions();
      
      if (permissionsGranted) {
        console.log('✅ Permissions granted');
        setHasPermissions(true);
      } else {
        console.log('❌ Permissions denied');
        setHasPermissions(false);
        toast.error('Health Connect permissions required');
      }
    } catch (error) {
      console.error('❌ Initialization error:', error);
      toast.error('Failed to connect to Health Connect');
      setHasPermissions(false);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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

  // Load activity data
  const loadActivityData = useCallback(async () => {
    try {
      console.log(`📊 Loading data for: ${selectedPeriod}`);
      
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
  }, [selectedPeriod, toast]);

  // Sync to backend
  const syncActivityToBackend = useCallback(async () => {
    if (isSyncing || selectedPeriod !== 'today') {
      console.log('⏭️ Skipping sync:', { isSyncing, selectedPeriod });
      return;
    }

    try {
      setIsSyncing(true);
      console.log('📤 Syncing to backend...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dataToSync = {
        date: today.toISOString(),
        steps: activityData.steps,
        distance: activityData.distance,
        activeCalories: activityData.activeCalories,
        totalCalories: activityData.totalCalories,
      };
      
      console.log('📤 Data to sync:', dataToSync);
      
      const response = await api.saveDailyActivity(dataToSync);
      
      if (response.success) {
        console.log('✅ Sync successful');
        toast.success('Activity synced successfully');
      } else {
        console.error('❌ Sync failed:', response);
        toast.error('Failed to sync activity data');
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  }, [activityData, isSyncing, selectedPeriod, toast]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadActivityData();
      toast.success('Data refreshed');
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadActivityData, toast]);

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

  // Manual sync handler
  const handleManualSync = useCallback(async () => {
    if (selectedPeriod !== 'today') {
      toast.info('Switch to "Today" to sync data');
      return;
    }
    
    await loadActivityData();
    await syncActivityToBackend();
  }, [selectedPeriod, loadActivityData, syncActivityToBackend, toast]);

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
          <Text style={styles.emptyText}>Initializing Health Connect...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No permissions state
  if (!hasPermissions) {
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
        <ScrollView contentContainerStyle={{ flex: 1 }}>
          <View style={styles.permissionsContainer}>
            <Icon name="shield-lock" size={64} color={colors.primary} />
            <Text style={styles.permissionsTitle}>Permissions Required</Text>
            <Text style={styles.permissionsText}>
              To track your steps and activity, we need access to your Health Connect data.
              {'\n\n'}
              This allows us to read your steps, distance, and calories burned.
            </Text>
            <TouchableOpacity style={styles.permissionsButton} onPress={handleRequestPermissions}>
              <Text style={styles.permissionsButtonText}>Grant Permissions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsLinkButton} onPress={handleOpenSettings}>
              <Text style={styles.settingsLinkText}>Open Health Connect Settings</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
            <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings}>
              <Icon name="cog" size={24} color={colors.text} />
            </TouchableOpacity>
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
              {selectedPeriod === 'today' ? 'Steps' : 'Total Steps'}
            </Text>
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