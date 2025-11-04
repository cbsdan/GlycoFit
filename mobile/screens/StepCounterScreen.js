import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Platform, 
  SafeAreaView, 
  ActivityIndicator, 
  Alert, 
  RefreshControl,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useHealthData from '../hooks/useHealthData';

const StepCounterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();
  const { androidPermissions, isInitialized, error, readHealthRecords } = useHealthData();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [todaySteps, setTodaySteps] = useState(0);
  const [weeklyData, setWeeklyData] = useState([]);

  const stepGoal = 10000; // Daily step goal

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setIsLoading(false);
      toast.error('Step tracking is only available on Android');
      return;
    }

    if (error) {
      setIsLoading(false);
      toast.error(error);
      return;
    }

    if (isInitialized) {
      setIsLoading(false);
      const hasStepsPermission = androidPermissions.some(
        p => p.recordType === 'Steps' && p.accessType === 'read'
      );
      
      if (hasStepsPermission) {
        loadStepsData();
      }
    }
  }, [isInitialized, error, androidPermissions]);

  const loadStepsData = async () => {
    try {
      // Get today's steps
      await fetchTodaySteps();
      
      // Get weekly data
      await fetchWeeklyData();
    } catch (error) {
      console.error('Error loading steps data:', error);
      toast.error('Failed to load steps data');
    }
  };

  const fetchTodaySteps = async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const timeRangeFilter = {
      operator: 'between',
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    };

    const records = await readHealthRecords('Steps', timeRangeFilter);
    
    if (records && records.records) {
      const totalSteps = records.records.reduce((sum, record) => sum + record.count, 0);
      setTodaySteps(totalSteps);
    }
  };

  const fetchWeeklyData = async () => {
    const now = new Date();
    const weekData = [];

    // Get data for last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const timeRangeFilter = {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString(),
      };

      const records = await readHealthRecords('Steps', timeRangeFilter);
      
      let totalSteps = 0;
      if (records && records.records) {
        totalSteps = records.records.reduce((sum, record) => sum + record.count, 0);
      }

      weekData.push({
        date: startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        totalSteps,
        fullDate: startOfDay.toISOString(),
      });
    }

    setWeeklyData(weekData);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStepsData();
    setIsRefreshing(false);
    toast.success('Data refreshed');
  };

  const getProgressPercentage = () => {
    return Math.min((todaySteps / stepGoal) * 100, 100);
  };

  const formatSteps = (steps) => {
    return steps.toLocaleString();
  };

  const getDayLabel = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
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
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      padding: 8,
      marginRight: 12,
      borderRadius: 8,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.secondary,
    },
    scrollContainer: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.secondary,
    },
    todayCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    todayTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    circularProgress: {
      width: 200,
      height: 200,
      borderRadius: 100,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      position: 'relative',
    },
    progressRing: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 12,
      borderColor: colors.border,
    },
    stepsCount: {
      fontSize: 48,
      fontWeight: '700',
      color: '#27AE60',
    },
    stepsLabel: {
      fontSize: 16,
      color: colors.secondary,
      marginTop: 4,
    },
    goalText: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: 8,
    },
    weeklySection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    weeklyCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    dayInfo: {
      flex: 1,
    },
    dayLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    dayDate: {
      fontSize: 12,
      color: colors.secondary,
    },
    daySteps: {
      alignItems: 'flex-end',
    },
    stepsValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#27AE60',
      marginBottom: 4,
    },
    stepsPercentage: {
      fontSize: 12,
      color: colors.secondary,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    permissionContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    permissionIcon: {
      marginBottom: 24,
    },
    permissionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    permissionText: {
      fontSize: 14,
      color: colors.secondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Step Counter</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Health Connect...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasStepsPermission = androidPermissions.some(
    p => p.recordType === 'Steps' && p.accessType === 'read'
  );

  if (!isInitialized || !hasStepsPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Step Counter</Text>
          </View>
        </View>
        <View style={styles.permissionContainer}>
          <Icon 
            name="shield-lock" 
            size={64} 
            color={colors.secondary} 
            style={styles.permissionIcon}
          />
          <Text style={styles.permissionTitle}>
            Health Connect Setup
          </Text>
          <Text style={styles.permissionText}>
            {!isInitialized 
              ? 'Health Connect is initializing. Please wait...' 
              : 'Permissions are being requested. Please grant access to step data in the Health Connect app.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Step Counter</Text>
          <Text style={styles.headerSubtitle}>Your daily activity</Text>
        </View>
      </View>

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
        {/* Today's Steps Card */}
        <View style={styles.todayCard}>
          <Text style={styles.todayTitle}>Today's Steps</Text>
          
          <View style={styles.circularProgress}>
            <View style={styles.progressRing} />
            <Text style={styles.stepsCount}>{formatSteps(todaySteps)}</Text>
          </View>

          <Text style={styles.stepsLabel}>steps</Text>
          <Text style={styles.goalText}>
            Goal: {formatSteps(stepGoal)} • {getProgressPercentage().toFixed(0)}% complete
          </Text>
        </View>

        {/* Weekly Overview */}
        <View style={styles.weeklySection}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          
          {weeklyData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon 
                name="walk" 
                size={64} 
                color={colors.secondary} 
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>No data yet</Text>
              <Text style={styles.emptySubtitle}>
                Start walking to see your step history here!
              </Text>
            </View>
          ) : (
            <View style={styles.weeklyCard}>
              {weeklyData.map((day, index) => (
                <View key={day.fullDate}>
                  <View style={styles.dayRow}>
                    <View style={styles.dayInfo}>
                      <Text style={styles.dayLabel}>{getDayLabel(day.fullDate)}</Text>
                      <Text style={styles.dayDate}>{day.date}</Text>
                    </View>
                    <View style={styles.daySteps}>
                      <Text style={styles.stepsValue}>
                        {formatSteps(day.totalSteps)}
                      </Text>
                      <Text style={styles.stepsPercentage}>
                        {((day.totalSteps / stepGoal) * 100).toFixed(0)}% of goal
                      </Text>
                    </View>
                  </View>
                  {index < weeklyData.length - 1 && (
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default StepCounterScreen;