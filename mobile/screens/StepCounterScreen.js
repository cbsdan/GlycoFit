import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  initializeHealthConnect,
  getActivityData,
  requestAllHealthPermissions,
  openHealthConnectSettingsPage,
} from '../services/healthConnectService';
import stepDetectionService from '../services/stepDetectionService';
import api from '../services/api';

const { width } = Dimensions.get('window');

// Constants
const SYNC_STEP_THRESHOLD = 50;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DAILY_GOAL = 10000;

// Achievements configuration
const ACHIEVEMENTS = [
  { id: 1, name: 'First Steps', requirement: 1000, icon: 'walk', color: '#3498DB' },
  { id: 2, name: 'Getting Started', requirement: 5000, icon: 'shoe-print', color: '#9B59B6' },
  { id: 3, name: 'Daily Goal', requirement: 10000, icon: 'trophy', color: '#F39C12' },
  { id: 4, name: 'Super Walker', requirement: 15000, icon: 'star', color: '#E74C3C' },
  { id: 5, name: 'Marathon', requirement: 20000, icon: 'medal', color: '#27AE60' },
  { id: 6, name: 'Ultra Runner', requirement: 30000, icon: 'crown', color: '#E67E22' },
];

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
  const [activityData, setActivityData] = useState({
    steps: 0,
    distance: 0,
    activeCalories: 0,
    totalCalories: 0,
    exerciseSessions: [],
    dailyData: [],
    hourlyData: [],
  });
  const [hasPermissions, setHasPermissions] = useState(false);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);

  // Refs
  const syncIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastAutoSyncRef = useRef(Date.now());
  const isMountedRef = useRef(true);
  const achievementAnimation = useRef(new Animated.Value(0)).current;

  const periods = useMemo(() => [
    { id: 'today', label: 'Today', icon: 'calendar-today' },
    { id: 'week', label: 'Week', icon: 'calendar-week' },
    { id: 'month', label: 'Month', icon: 'calendar-month' },
  ], []);

  // Memoized date range calculator
  const getDateRange = useCallback((period) => {
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
    }

    return { startDate, endDate };
  }, []);

  // Calculate streak
  const calculateStreak = useCallback((dailyData) => {
    if (!dailyData || dailyData.length === 0) return { current: 0, longest: 0 };

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const sortedData = [...dailyData].sort((a, b) => new Date(b.date) - new Date(a.date));

    for (let i = 0; i < sortedData.length; i++) {
      if (sortedData[i].steps >= DAILY_GOAL) {
        tempStreak++;
        if (i === 0 || new Date(sortedData[i].date).getTime() === new Date(sortedData[i - 1].date).getTime() - 86400000) {
          currentStreak = tempStreak;
        }
      } else {
        if (i === 0) currentStreak = 0;
        tempStreak = 0;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    return { current: currentStreak, longest: longestStreak };
  }, []);

  // Check and unlock achievements
  const checkAchievements = useCallback((steps) => {
    const newUnlocked = [];
    ACHIEVEMENTS.forEach(achievement => {
      if (steps >= achievement.requirement && !unlockedAchievements.includes(achievement.id)) {
        newUnlocked.push(achievement.id);
        // Animate achievement unlock
        Animated.sequence([
          Animated.timing(achievementAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
          Animated.timing(achievementAnimation, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        
        toast.success(`🏆 Achievement Unlocked: ${achievement.name}!`);
      }
    });

    if (newUnlocked.length > 0) {
      setUnlockedAchievements(prev => [...prev, ...newUnlocked]);
    }
  }, [unlockedAchievements, achievementAnimation, toast]);

  // Generate hourly data
  const generateHourlyData = useCallback((stepsData) => {
    const hourlyMap = new Map();
    
    // Initialize all hours with 0
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0);
    }

    if (stepsData && Array.isArray(stepsData)) {
      stepsData.forEach(record => {
        const hour = new Date(record.startTime || record.time).getHours();
        hourlyMap.set(hour, hourlyMap.get(hour) + (Number(record?.count) || 0));
      });
    }

    return Array.from(hourlyMap.entries()).map(([hour, steps]) => ({ hour, steps }));
  }, []);

  // Predict end of day steps
  const predictedSteps = useMemo(() => {
    if (selectedPeriod !== 'today' || activityData.steps === 0) return null;

    const now = new Date();
    const minutesPassed = now.getHours() * 60 + now.getMinutes();
    
    if (minutesPassed === 0) return activityData.steps;
    
    const stepsPerMinute = activityData.steps / minutesPassed;
    const predicted = Math.round(stepsPerMinute * 1440); // 1440 minutes in a day
    
    return predicted > activityData.steps ? predicted : activityData.steps;
  }, [activityData.steps, selectedPeriod]);

  // Generate health insights
  const healthInsights = useMemo(() => {
    const insights = [];

    if (selectedPeriod === 'today') {
      const progress = (activityData.steps / DAILY_GOAL) * 100;
      
      if (progress >= 100) {
        insights.push({ type: 'success', icon: 'check-circle', message: '🎉 Daily goal achieved! Great job!', color: '#27AE60' });
      } else if (progress >= 75) {
        insights.push({ type: 'info', icon: 'trending-up', message: '💪 Almost there! Keep going!', color: '#F39C12' });
      } else if (progress < 25) {
        insights.push({ type: 'warning', icon: 'alert-circle', message: '👟 Time to get moving!', color: '#E74C3C' });
      }

      if (predictedSteps && predictedSteps >= DAILY_GOAL) {
        insights.push({ type: 'info', icon: 'chart-line', message: `📈 On track to reach ${predictedSteps.toLocaleString()} steps`, color: '#3498DB' });
      }

      if (streak.current > 0) {
        insights.push({ type: 'success', icon: 'fire', message: `🔥 ${streak.current} day streak! Keep it up!`, color: '#E67E22' });
      }
    } else if (selectedPeriod === 'week' && activityData.dailyData.length > 0) {
      const thisWeekAvg = activityData.steps / 7;
      const lastWeekData = activityData.dailyData.slice(7, 14);
      const lastWeekTotal = lastWeekData.reduce((sum, day) => sum + day.steps, 0);
      const lastWeekAvg = lastWeekData.length > 0 ? lastWeekTotal / lastWeekData.length : 0;

      if (lastWeekAvg > 0) {
        const change = ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
        if (change > 0) {
          insights.push({ 
            type: 'success', 
            icon: 'trending-up', 
            message: `📈 ${change.toFixed(0)}% increase from last week!`, 
            color: '#27AE60' 
          });
        } else if (change < 0) {
          insights.push({ 
            type: 'warning', 
            icon: 'trending-down', 
            message: `📉 ${Math.abs(change).toFixed(0)}% decrease from last week`, 
            color: '#E74C3C' 
          });
        }
      }
    }

    const calories = activityData.activeCalories;
    if (calories > 500) {
      insights.push({ type: 'success', icon: 'fire', message: `🔥 Burned ${Math.round(calories)} active calories`, color: '#E74C3C' });
    }

    return insights;
  }, [activityData, selectedPeriod, predictedSteps, streak]);

  // Optimized calculation functions
  const calculateTotalSteps = useCallback((stepsData) => {
    if (!Array.isArray(stepsData) || stepsData.length === 0) return 0;
    return stepsData.reduce((total, record) => total + (Number(record?.count) || 0), 0);
  }, []);

  const calculateTotalDistance = useCallback((distanceData) => {
    if (!Array.isArray(distanceData) || distanceData.length === 0) return 0;
    return distanceData.reduce((total, record) => total + (Number(record?.distance?.inMeters) || 0), 0);
  }, []);

  const calculateTotalCalories = useCallback((caloriesData) => {
    if (!Array.isArray(caloriesData) || caloriesData.length === 0) return 0;
    return caloriesData.reduce((total, record) => total + (Number(record?.energy?.inKilocalories) || 0), 0);
  }, []);

  // Group data by day (optimized)
  const groupDataByDay = useCallback((stepsData, distanceData, caloriesData) => {
    const dayMap = new Map();

    const processRecord = (record, field, getValue) => {
      const date = new Date(record.startTime || record.time).toDateString();
      if (!dayMap.has(date)) {
        dayMap.set(date, { date, steps: 0, distance: 0, calories: 0 });
      }
      dayMap.get(date)[field] += getValue(record);
    };

    stepsData?.forEach(record => processRecord(record, 'steps', r => Number(r?.count || 0)));
    distanceData?.forEach(record => processRecord(record, 'distance', r => Number(r?.distance?.inMeters || 0)));
    caloriesData?.forEach(record => processRecord(record, 'calories', r => Number(r?.energy?.inKilocalories || 0)));

    return Array.from(dayMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, []);

  // Update today's steps
  const updateTodaySteps = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      let totalSteps = 0;
      let distance = 0;
      let calories = 0;
      let hourlyData = [];

      if (hasPermissions) {
        const { startDate, endDate } = getDateRange('today');
        const healthData = await getActivityData(startDate, endDate);

        totalSteps = calculateTotalSteps(healthData.steps);
        distance = calculateTotalDistance(healthData.distance);
        calories = calculateTotalCalories(healthData.totalCalories);
        hourlyData = generateHourlyData(healthData.steps);

        console.log(`📊 Health Connect: ${totalSteps} steps`);
      } else {
        totalSteps = phoneSensorSteps;
        distance = stepDetectionService.calculateDistance(phoneSensorSteps);
        calories = stepDetectionService.calculateCalories(phoneSensorSteps);

        console.log(`📱 Phone sensor: ${totalSteps} steps`);
      }

      if (isMountedRef.current) {
        setActivityData(prev => ({
          ...prev,
          steps: totalSteps,
          distance,
          activeCalories: calories * 0.7,
          totalCalories: calories,
          hourlyData,
        }));
        checkAchievements(totalSteps);
      }
    } catch (error) {
      console.error('❌ Update error:', error);
    }
  }, [phoneSensorSteps, hasPermissions, getDateRange, calculateTotalSteps, calculateTotalDistance, calculateTotalCalories, generateHourlyData, checkAchievements]);

  // Load activity data for week/month
  const loadActivityData = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      console.log(`📊 Loading data for: ${selectedPeriod}`);

      if (!hasPermissions) {
        setActivityData({
          steps: phoneSensorSteps,
          distance: stepDetectionService.calculateDistance(phoneSensorSteps),
          activeCalories: stepDetectionService.calculateCalories(phoneSensorSteps) * 0.7,
          totalCalories: stepDetectionService.calculateCalories(phoneSensorSteps),
          exerciseSessions: [],
          dailyData: [],
          hourlyData: [],
        });
        return;
      }

      const { startDate, endDate } = getDateRange(selectedPeriod);
      const data = await getActivityData(startDate, endDate);

      const totalSteps = calculateTotalSteps(data.steps);
      const totalDistance = calculateTotalDistance(data.distance);
      const totalActiveCalories = calculateTotalCalories(data.activeCalories);
      const totalCalories = calculateTotalCalories(data.totalCalories);

      const dailyData = selectedPeriod !== 'today'
        ? groupDataByDay(data.steps, data.distance, data.totalCalories)
        : [];

      const streakData = calculateStreak(dailyData);
      setStreak(streakData);

      if (isMountedRef.current) {
        setActivityData({
          steps: totalSteps,
          distance: totalDistance,
          activeCalories: totalActiveCalories,
          totalCalories: totalCalories,
          exerciseSessions: data.exerciseSessions || [],
          dailyData,
          hourlyData: [],
        });
      }

      console.log('✅ Data loaded');
    } catch (error) {
      console.error('❌ Load error:', error);
      toast.error('Failed to load activity data');
    }
  }, [selectedPeriod, phoneSensorSteps, hasPermissions, toast, getDateRange, calculateTotalSteps, calculateTotalDistance, calculateTotalCalories, groupDataByDay, calculateStreak]);

  // Sync to backend
  const syncActivityToBackend = useCallback(async (silent = false) => {
    if (isSyncing || selectedPeriod !== 'today' || !isMountedRef.current) {
      return;
    }

    try {
      setIsSyncing(true);
      if (!silent) console.log('📤 Syncing to backend...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dataToSync = {
        date: today.toISOString(),
        steps: activityData.steps,
        distance: activityData.distance,
        activeCalories: activityData.activeCalories,
        totalCalories: activityData.totalCalories,
        source: hasPermissions ? 'health_connect' : 'phone_sensor',
        phoneSensorSteps: phoneSensorSteps,
        healthConnectSteps: hasPermissions ? activityData.steps : 0,
        streak: streak.current,
        achievements: unlockedAchievements,
      };

      const response = await api.saveDailyActivity(dataToSync);

      if (response.success) {
        if (!silent) {
          console.log('✅ Sync successful');
          toast.success('Activity synced successfully');
        }
      } else {
        console.error('❌ Sync failed:', response);
        if (!silent) toast.error('Failed to sync activity data');
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      if (!silent) toast.error('Sync failed: ' + error.message);
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [isSyncing, selectedPeriod, phoneSensorSteps, activityData, hasPermissions, streak, unlockedAchievements, toast]);

  // Perform auto-sync
  const performAutoSync = useCallback(async () => {
    if (isSyncing || selectedPeriod !== 'today' || !isMountedRef.current) return;

    try {
      await updateTodaySteps();
      await syncActivityToBackend(true);
      setLastSyncedSteps(phoneSensorSteps);
      lastAutoSyncRef.current = Date.now();
    } catch (error) {
      console.error('❌ Auto-sync error:', error);
    }
  }, [isSyncing, selectedPeriod, phoneSensorSteps, updateTodaySteps, syncActivityToBackend]);

  // Initialize services
  const initializeServices = useCallback(async () => {
    try {
      console.log('🔧 Initializing services...');

      // Initialize Health Connect FIRST
      await initializeHealthConnect();
      const permissionsGranted = await requestAllHealthPermissions();

      setHasPermissions(permissionsGranted);

      if (permissionsGranted) {
        console.log('✅ Health Connect permissions granted');
        console.log('⚠️ Phone sensor will NOT be started (Health Connect is active)');
        // Don't start phone sensor - Health Connect handles everything
        // This prevents duplicate counting and saves battery
        
      } else {
        console.log('⚠️ Health Connect permissions denied');
        console.log('📱 Starting phone sensor as fallback');
        
        // ONLY start phone sensor if Health Connect not available
        await stepDetectionService.initialize();
        stepDetectionService.start();

        const unsubscribe = stepDetectionService.addListener((steps) => {
          if (isMountedRef.current) {
            setPhoneSensorSteps(steps);
          }
        });

        const currentSteps = stepDetectionService.getStepCount();
        setPhoneSensorSteps(currentSteps);
        setLastSyncedSteps(currentSteps);

        console.log('✅ Phone sensor started:', currentSteps, 'steps');
        
        await updateTodaySteps();
        await performAutoSync();
        
        return unsubscribe;
      }

      await updateTodaySteps();
      await performAutoSync();

    } catch (error) {
      console.error('❌ Initialization error:', error);
      toast.error('Failed to initialize step tracking');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [toast, updateTodaySteps, performAutoSync]);

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
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [selectedPeriod, updateTodaySteps, performAutoSync, loadActivityData, toast]);

  // Manual sync handler
  const handleManualSync = useCallback(async () => {
    if (selectedPeriod !== 'today') {
      toast.info('Switch to "Today" to sync data');
      return;
    }

    await updateTodaySteps();
    await syncActivityToBackend(false);
  }, [selectedPeriod, updateTodaySteps, syncActivityToBackend, toast]);

  // Initialize on mount
  useEffect(() => {
    let unsubscribe;
    
    initializeServices().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      isMountedRef.current = false;
      stepDetectionService.stop();
      if (unsubscribe) unsubscribe();
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []);

  // Reload data when period changes
  // useEffect(() => {
  //   if (!isLoading) {
  //     if (selectedPeriod === 'today') {
  //       updateTodaySteps();
  //     } else if (hasPermissions) {
  //       loadActivityData();
  //     }
  //   }
  // }, [selectedPeriod, hasPermissions, isLoading]);

  // ...existing code...

// Reload data when period changes
useEffect(() => {
  if (!isLoading) {
    if (selectedPeriod === 'today') {
      updateTodaySteps();
    } else {
      // Call loadActivityData for both week and month
      loadActivityData();
    }
  }
}, [selectedPeriod, isLoading, updateTodaySteps, loadActivityData]);

  // Auto-sync based on step milestones
  useEffect(() => {
    if (selectedPeriod === 'today' && phoneSensorSteps > 0) {
      const stepDifference = phoneSensorSteps - lastSyncedSteps;

      if (stepDifference >= SYNC_STEP_THRESHOLD) {
        console.log(`🎯 Step milestone: ${phoneSensorSteps} steps (${stepDifference} new)`);
        performAutoSync();
      }
    }
  }, [phoneSensorSteps, selectedPeriod, lastSyncedSteps, performAutoSync]);

  // Periodic auto-sync
  useEffect(() => {
    if (selectedPeriod === 'today') {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);

      syncIntervalRef.current = setInterval(() => {
        const timeSinceLastSync = Date.now() - lastAutoSyncRef.current;

        if (timeSinceLastSync >= SYNC_INTERVAL_MS) {
          console.log('⏰ Periodic auto-sync');
          performAutoSync();
        }
      }, SYNC_INTERVAL_MS);

      return () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      };
    }
  }, [selectedPeriod, performAutoSync]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App to foreground');
        updateTodaySteps();
        performAutoSync();
      }

      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('📱 App to background');
        performAutoSync();
      }

      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [updateTodaySteps, performAutoSync]);

  // Auto-sync when leaving screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      console.log('👋 Leaving screen');
      performAutoSync();
    });

    return unsubscribe;
  }, [navigation, performAutoSync]);

  // Memoized calculations
  const stepGoalProgress = useMemo(() => {
    const progress = (activityData.steps / DAILY_GOAL) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }, [activityData.steps]);

  const averageSteps = useMemo(() => {
    const days = selectedPeriod === 'week' ? 7 : 30;
    return Math.round(activityData.steps / days);
  }, [activityData.steps, selectedPeriod]);

  const maxSteps = useMemo(() => {
    if (activityData.dailyData.length === 0) return DAILY_GOAL;
    return Math.max(...activityData.dailyData.map(d => d.steps), DAILY_GOAL);
  }, [activityData.dailyData]);

  // Format functions
  const formatDistance = useCallback((meters) => {
    const m = Number(meters) || 0;
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
  }, []);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, []);

  // Render streak badge
  const renderStreakBadge = useCallback(() => {
    if (streak.current === 0) return null;

    return (
      <View style={styles.streakCard}>
        <View style={styles.streakIconContainer}>
          <Icon name="fire" size={32} color="#E67E22" />
        </View>
        <View style={styles.streakInfo}>
          <Text style={styles.streakNumber}>{streak.current} days</Text>
          <Text style={styles.streakLabel}>Current Streak</Text>
          {streak.longest > streak.current && (
            <Text style={styles.streakBest}>Best: {streak.longest} days</Text>
          )}
        </View>
      </View>
    );
  }, [streak]);

  // Render achievements
  const renderAchievements = useCallback(() => {
    const nextAchievement = ACHIEVEMENTS.find(a => activityData.steps < a.requirement);
    const completed = ACHIEVEMENTS.filter(a => unlockedAchievements.includes(a.id));

    return (
      <View style={styles.achievementsCard}>
        <View style={styles.achievementsHeader}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <Text style={styles.achievementsCount}>
            {completed.length}/{ACHIEVEMENTS.length}
          </Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsList}>
          {ACHIEVEMENTS.map(achievement => {
            const isUnlocked = unlockedAchievements.includes(achievement.id);
            return (
              <View
                key={achievement.id}
                style={[
                  styles.achievementBadge,
                  { borderColor: achievement.color, opacity: isUnlocked ? 1 : 0.4 }
                ]}
              >
                <View style={[styles.achievementIcon, { backgroundColor: achievement.color + '20' }]}>
                  <Icon
                    name={achievement.icon}
                    size={28}
                    color={isUnlocked ? achievement.color : colors.secondary}
                  />
                </View>
                <Text style={styles.achievementName} numberOfLines={2}>
                  {achievement.name}
                </Text>
                <Text style={styles.achievementRequirement}>
                  {achievement.requirement.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {nextAchievement && selectedPeriod === 'today' && (
          <View style={styles.nextAchievement}>
            <Text style={styles.nextAchievementText}>
              Next: {nextAchievement.name} - {(nextAchievement.requirement - activityData.steps).toLocaleString()} steps to go
            </Text>
          </View>
        )}
      </View>
    );
  }, [activityData.steps, unlockedAchievements, selectedPeriod, colors]);

  // Render hourly chart
  const renderHourlyChart = useCallback(() => {
    if (selectedPeriod !== 'today' || activityData.hourlyData.length === 0) return null;

    const maxHourlySteps = Math.max(...activityData.hourlyData.map(h => h.steps), 100);
    const currentHour = new Date().getHours();

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Hourly Activity</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {activityData.hourlyData.map((hourData, index) => {
              const height = (hourData.steps / maxHourlySteps) * 120;
              const isCurrent = hourData.hour === currentHour;
              return (
                <View
                  key={`hour-${index}`}
                  style={[
                    styles.hourlyBar,
                    {
                      height: Math.max(height, 2),
                      opacity: hourData.steps > 0 ? 0.8 : 0.3,
                      backgroundColor: isCurrent ? colors.primary : colors.primary + '80',
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.chartLabels}>
            {[0, 6, 12, 18, 23].map(hour => (
              <Text key={`hour-label-${hour}`} style={styles.chartLabel}>
                {hour}h
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  }, [selectedPeriod, activityData.hourlyData, colors]);

  // Render health insights
  const renderHealthInsights = useCallback(() => {
    if (healthInsights.length === 0) return null;

    return (
      <View style={styles.insightsCard}>
        <Text style={styles.sectionTitle}>Insights</Text>
        {healthInsights.map((insight, index) => (
          <View key={`insight-${index}`} style={styles.insightItem}>
            <Icon name={insight.icon} size={20} color={insight.color} />
            <Text style={styles.insightText}>{insight.message}</Text>
          </View>
        ))}
        
        {predictedSteps && selectedPeriod === 'today' && (
          <View style={[styles.insightItem, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Icon name="crystal-ball" size={20} color="#9B59B6" />
            <Text style={styles.insightText}>
              Predicted end of day: {predictedSteps.toLocaleString()} steps
            </Text>
          </View>
        )}
      </View>
    );
  }, [healthInsights, predictedSteps, selectedPeriod, colors]);

  // Render steps badge
  const renderStepsBadge = useCallback(() => {
    if (selectedPeriod !== 'today') return null;

    if (hasPermissions) {
      const otherAppsSteps = Math.max(0, activityData.steps - phoneSensorSteps);

      return (
        <>
          {/* <View style={styles.sensorBadge}>
            <Icon name="cellphone" size={14} color={colors.primary} />
            <Text style={styles.sensorBadgeText}>
              {phoneSensorSteps.toLocaleString()} from this app
            </Text>
          </View> */}
          {/* {otherAppsSteps > 0 && (
            <View style={[styles.sensorBadge, { marginTop: 4, backgroundColor: '#4CAF5015' }]}>
              <Icon name="google-fit" size={14} color="#4CAF50" />
              <Text style={[styles.sensorBadgeText, { color: '#4CAF50' }]}>
                {otherAppsSteps.toLocaleString()} from other apps
              </Text>
            </View>
          )} */}
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
  }, [selectedPeriod, hasPermissions, activityData.steps, phoneSensorSteps, colors.primary]);

  // Render chart
  const renderChart = useCallback(() => {
    if (selectedPeriod === 'today' || activityData.dailyData.length === 0) return null;

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
  }, [selectedPeriod, activityData.dailyData, maxSteps]);

  // Render daily breakdown
  const renderDailyBreakdown = useCallback(() => {
    if (selectedPeriod === 'today' || activityData.dailyData.length === 0) return null;

    return (
      <View style={styles.dailyBreakdownSection}>
        <Text style={styles.sectionTitle}>Daily Breakdown</Text>
        {activityData.dailyData.slice(0, 7).map((day, index) => (
          <View key={`day-${index}`} style={styles.dailyCard}>
            <View style={styles.dailyCardHeader}>
              <Text style={styles.dailyDate}>{formatDate(day.date)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {day.steps >= DAILY_GOAL && (
                  <Icon name="check-circle" size={20} color="#27AE60" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.dailySteps}>{day.steps.toLocaleString()} steps</Text>
              </View>
            </View>
            <View style={styles.dailyMetrics}>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>{formatDistance(day.distance)}</Text>
                <Text style={styles.dailyMetricLabel}>Distance</Text>
              </View>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>{Math.round(day.calories)}</Text>
                <Text style={styles.dailyMetricLabel}>Calories</Text>
              </View>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>
                  {Math.round((day.steps / DAILY_GOAL) * 100)}%
                </Text>
                <Text style={styles.dailyMetricLabel}>Goal</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }, [selectedPeriod, activityData.dailyData, formatDate, formatDistance]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center', marginHorizontal: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    settingsButton: { padding: 8, marginLeft: 4 },
    periodSelector: { flexDirection: 'row', justifyContent: 'space-between' },
    periodButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginHorizontal: 4, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    periodButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    periodButtonText: { fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 6 },
    periodButtonTextActive: { color: 'white' },
    scrollContent: { padding: 16 },
    mainStatsCard: { backgroundColor: colors.card, borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: colors.border, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    stepsContainer: { alignItems: 'center', marginBottom: 24 },
    stepsIcon: { marginBottom: 16 },
    stepsCount: { fontSize: 56, fontWeight: 'bold', color: colors.primary, marginBottom: 8 },
    stepsLabel: { fontSize: 16, color: colors.secondary, fontWeight: '500' },
    sensorBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 8 },
    sensorBadgeText: { fontSize: 12, color: colors.primary, marginLeft: 6, fontWeight: '500' },
    averageContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
    averageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    averageLabel: { fontSize: 16, color: colors.secondary, fontWeight: '500' },
    averageValue: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
    goalProgress: { marginTop: 16 },
    goalProgressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    goalProgressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
    goalText: { fontSize: 14, color: colors.secondary, textAlign: 'center' },
    streakCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
    streakIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E67E2215', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    streakInfo: { flex: 1 },
    streakNumber: { fontSize: 28, fontWeight: 'bold', color: colors.text },
    streakLabel: { fontSize: 14, color: colors.secondary, marginTop: 4 },
    streakBest: { fontSize: 12, color: colors.secondary, marginTop: 2 },
    achievementsCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    achievementsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    achievementsCount: { fontSize: 16, fontWeight: '600', color: colors.primary },
    achievementsList: { marginBottom: 12 },
    achievementBadge: { width: 90, alignItems: 'center', marginRight: 12, padding: 12, borderRadius: 12, borderWidth: 2 },
    achievementIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    achievementName: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 4 },
    achievementRequirement: { fontSize: 11, color: colors.secondary, textAlign: 'center' },
    nextAchievement: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    nextAchievementText: { fontSize: 13, color: colors.secondary, textAlign: 'center' },
    insightsCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    insightItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    insightText: { fontSize: 14, color: colors.text, marginLeft: 12, flex: 1 },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
    metricCard: { width: (width - 48) / 2, backgroundColor: colors.card, borderRadius: 16, padding: 20, margin: 8, borderWidth: 1, borderColor: colors.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    metricIconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    metricValue: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    metricLabel: { fontSize: 14, color: colors.secondary, fontWeight: '500' },
    chartCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    chartTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
    chartContainer: { height: 200 },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, paddingHorizontal: 8 },
    chartBar: { flex: 1, marginHorizontal: 2, backgroundColor: colors.primary, borderRadius: 4, minHeight: 2, opacity: 0.8 },
    hourlyBar: { flex: 1, marginHorizontal: 1, borderRadius: 2, minHeight: 2 },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 8 },
    chartLabel: { fontSize: 10, color: colors.secondary, flex: 1, textAlign: 'center' },
    dailyBreakdownSection: { marginTop: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
    dailyCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    dailyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    dailyDate: { fontSize: 16, fontWeight: '600', color: colors.text },
    dailySteps: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
    dailyMetrics: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    dailyMetric: { alignItems: 'center' },
    dailyMetricValue: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    dailyMetricLabel: { fontSize: 12, color: colors.secondary },
    sessionsSection: { marginTop: 16 },
    sessionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
    sessionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    sessionInfo: { flex: 1 },
    sessionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    sessionDetails: { fontSize: 14, color: colors.secondary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 200 },
    emptyText: { fontSize: 16, color: colors.secondary, textAlign: 'center', marginTop: 16 },
  });

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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step Counter</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.settingsButton} onPress={handleManualSync} disabled={isSyncing}>
              <Icon name={isSyncing ? "sync" : "cloud-upload"} size={24} color={isSyncing ? colors.secondary : colors.text} />
            </TouchableOpacity>
            {hasPermissions && (
              <TouchableOpacity style={styles.settingsButton} onPress={openHealthConnectSettingsPage}>
                <Icon name="cog" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.periodSelector}>
          {periods.map(period => (
            <TouchableOpacity
              key={period.id}
              style={[styles.periodButton, selectedPeriod === period.id && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(period.id)}
            >
              <Icon name={period.icon} size={18} color={selectedPeriod === period.id ? 'white' : colors.text} />
              <Text style={[styles.periodButtonText, selectedPeriod === period.id && styles.periodButtonTextActive]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.mainStatsCard}>
          <View style={styles.stepsContainer}>
            <View style={styles.stepsIcon}>
              <Icon name="walk" size={64} color={colors.primary} />
            </View>
            <Text style={styles.stepsCount}>{activityData.steps.toLocaleString()}</Text>
            <Text style={styles.stepsLabel}>{selectedPeriod === 'today' ? 'Steps Today' : 'Total Steps'}</Text>
            {renderStepsBadge()}
          </View>

          {selectedPeriod === 'today' && (
            <View style={styles.goalProgress}>
              <View style={styles.goalProgressBar}>
                <View style={[styles.goalProgressFill, { width: `${stepGoalProgress}%` }]} />
              </View>
              <Text style={styles.goalText}>{stepGoalProgress.toFixed(0)}% of daily goal ({DAILY_GOAL.toLocaleString()} steps)</Text>
            </View>
          )}

          {selectedPeriod !== 'today' && (
            <View style={styles.averageContainer}>
              <View style={styles.averageRow}>
                <Text style={styles.averageLabel}>Daily Average</Text>
                <Text style={styles.averageValue}>{averageSteps.toLocaleString()}</Text>
              </View>
            </View>
          )}
        </View>

        {renderStreakBadge()}
        {renderHealthInsights()}
        {renderAchievements()}
        {renderHourlyChart()}
        {renderChart()}

        

        {renderDailyBreakdown()}

        {selectedPeriod === 'today' && activityData.exerciseSessions.length > 0 && (
          <View style={styles.sessionsSection}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            {activityData.exerciseSessions.slice(0, 5).map((session, index) => (
              <View key={`session-${index}`} style={styles.sessionCard}>
                <View style={[styles.sessionIcon, { backgroundColor: '#27AE6015' }]}>
                  <Icon name="run" size={24} color="#27AE60" />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle}>{session.exerciseType || 'Exercise'}</Text>
                  <Text style={styles.sessionDetails}>
                    {session.duration ? `${Math.round(session.duration / 60)} min` : 'N/A'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activityData.steps === 0 && !isRefreshing && (
          <View style={styles.centerContainer}>
            <Icon name="information-outline" size={64} color={colors.secondary} />
            <Text style={styles.emptyText}>
              No activity data found for this period.{'\n'}Start moving to see your stats!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StepCounterScreen;