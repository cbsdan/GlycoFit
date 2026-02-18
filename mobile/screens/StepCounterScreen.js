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
  Alert,
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
import { getStepBaseline, getStepSummary,checkStepBaseline } from '../services/api';
import api from '../services/api'; // ADD THIS LINE
import { useFocusEffect } from '@react-navigation/native';
import { LifestyleRecommendationsSection } from '../components/recommendations';

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
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [previousDaySteps, setPreviousDaySteps] = useState(null);
  const [activityData, setActivityData] = useState({
    steps: 0,
    distance: 0,
    activeCalories: 0,
    totalCalories: 0,
    exerciseSessions: [],
    dailyData: [],
  });
  const [hasPermissions, setHasPermissions] = useState(false);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [baselineData, setBaselineData] = useState(null);
  const [summary, setSummary] = useState(null); // ADD THIS LINE

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
const groupDataByDay = useCallback((stepsData, distanceData, caloriesData, activeCaloriesData) => {
  console.log('🔍 groupDataByDay inputs:', {
    stepsCount: stepsData?.length || 0,
    distanceCount: distanceData?.length || 0,
    caloriesCount: caloriesData?.length || 0,
    activeCaloriesCount: activeCaloriesData?.length || 0
  });

  const dayMap = new Map();

  const processRecord = (record, field, getValue) => {
    const date = new Date(record.startTime || record.time).toDateString();
    if (!dayMap.has(date)) {
      dayMap.set(date, { date, steps: 0, distance: 0, calories: 0, activeCalories: 0 });
    }
    const value = getValue(record);
    dayMap.get(date)[field] += value;
  };

  // Process steps and distance data (ignore Health Connect calorie data)
  stepsData?.forEach(record => processRecord(record, 'steps', r => Number(r?.count || 0)));
  distanceData?.forEach(record => processRecord(record, 'distance', r => Number(r?.distance?.inMeters || 0)));
  // ⚠️ Skip Health Connect calorie data - we'll calculate from steps for accuracy

  // ✅ FIX: Always calculate calories from steps (more reliable than Health Connect data)
  const result = Array.from(dayMap.values()).map(day => {
    // Calculate distance from steps if not available
    if (day.distance === 0 && day.steps > 0) {
      day.distance = stepDetectionService.calculateDistance(day.steps);
    }
    
    // Always calculate calories from steps (don't trust Health Connect calorie data)
    if (day.steps > 0) {
      day.calories = stepDetectionService.calculateCalories(day.steps);
      day.activeCalories = day.calories * 0.7; // ~70% of total calories are active
    }
    
    return day;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  console.log('📊 groupDataByDay result (first 2 days):', result.slice(0, 2));
  
  return result;
}, []);


  // Update today's steps
  const updateTodaySteps = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      let totalSteps = 0;
      let distance = 0;
      let calories = 0;
      

      if (hasPermissions) {
        const { startDate, endDate } = getDateRange('today');
        const healthData = await getActivityData(startDate, endDate);

        totalSteps = calculateTotalSteps(healthData.steps);
        distance = calculateTotalDistance(healthData.distance);
        // ✅ FIX: Always calculate calories from steps (don't trust Health Connect calorie data)
        calories = stepDetectionService.calculateCalories(totalSteps);
        

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
          
        }));
        checkAchievements(totalSteps);
      }
    } catch (error) {
      console.error('❌ Update error:', error);
    }
  }, [phoneSensorSteps, hasPermissions, getDateRange, calculateTotalSteps, calculateTotalDistance, calculateTotalCalories, checkAchievements]);

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
      });
      return;
    }

    const { startDate, endDate } = getDateRange(selectedPeriod);
    const data = await getActivityData(startDate, endDate);

    console.log('📊 Raw data from Health Connect:', {
      steps: data.steps?.length || 0,
      distance: data.distance?.length || 0,
      totalCalories: data.totalCalories?.length || 0,
      activeCalories: data.activeCalories?.length || 0
    });

    const totalSteps = calculateTotalSteps(data.steps);
    let totalDistance = calculateTotalDistance(data.distance);
    
    // ✅ FIX: Always calculate calories from steps (don't trust Health Connect calorie data)
    let totalCalories = stepDetectionService.calculateCalories(totalSteps);
    let totalActiveCalories = totalCalories * 0.7; // ~70% of total calories are active

    // Calculate missing distance from steps if needed
    if (totalDistance === 0 && totalSteps > 0) {
      totalDistance = stepDetectionService.calculateDistance(totalSteps);
      console.log(`📊 Calculated total distance: ${totalDistance}m from ${totalSteps} steps`);
    } else if (totalDistance > 0) {
      console.log(`📊 Using Health Connect distance: ${totalDistance}m`);
    }

    console.log(`📊 Calculated calories from ${totalSteps} steps: ${totalCalories} kcal (${totalActiveCalories} active)`);

    console.log('📊 Totals calculated:', {
      totalSteps,
      totalDistance,
      totalActiveCalories,
      totalCalories
    });

    const dailyData = selectedPeriod !== 'today'
      ? groupDataByDay(
          data.steps,           
          data.distance,        
          data.totalCalories,   
          data.activeCalories   
        )
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
      });
    }

    console.log('✅ Data loaded successfully');
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

      if (response && response.success) {
        if (!silent) {
          console.log('✅ Sync successful');
          toast.success('Activity synced successfully');
        }

        // Mark last synced steps so auto-sync milestones don't re-send the same delta
        const syncedSteps = (response.saved && (response.saved.steps || response.saved.steps === 0)) ? response.saved.steps : (dataToSync.steps || phoneSensorSteps);
        if (isMountedRef.current) {
          setLastSyncedSteps(syncedSteps);
        }

        // Set last synced timestamp if returned by backend
        const serverLastSynced = response.saved && (response.saved.last_synced_at || response.saved.lastSyncedAt || response.last_synced_at);
        if (serverLastSynced) {
          try {
            const parsed = new Date(serverLastSynced);
            if (isMountedRef.current) setLastSyncedAt(parsed);
          } catch (e) {
            // ignore parse errors
          }
        }

        // Merge saved values returned from backend into local activity state
        if (response.saved) {
          const saved = response.saved;
          setActivityData(prev => ({
            ...prev,
            steps: saved.steps != null ? saved.steps : prev.steps,
            distance: saved.distance != null ? saved.distance : prev.distance,
            activeCalories: saved.active_calories != null ? saved.active_calories : prev.activeCalories,
            totalCalories: saved.total_calories != null ? saved.total_calories : prev.totalCalories,
          }));
        }
        // Also capture previous day steps (if backend returned it)
        if (response.previous_day_steps !== undefined) {
          if (isMountedRef.current) setPreviousDaySteps(response.previous_day_steps);
        }
        // Refresh summary/recent records from backend to ensure UI shows synced data and risk
        try {
          const summaryResp = await getStepSummary(7);
          const summaryData = summaryResp?.data || summaryResp;
          if (isMountedRef.current) setSummary(summaryData);
        } catch (e) {
          console.warn('Failed to refresh summary after sync', e);
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

  // Check for baseline on screen focus
  useFocusEffect(
    useCallback(() => {
      checkBaseline();
    }, [])
  );

const checkBaseline = async () => {
  try {
    console.log('🔍 Checking for baseline...');
    
    // Always load summary first with proper error handling
    try {
      const summaryResponse = await getStepSummary(30);
      console.log('📊 Raw summary response:', JSON.stringify(summaryResponse, null, 2));
      
      // Handle different response structures
      const summaryData = summaryResponse?.data || summaryResponse;
      console.log('📊 Summary data:', summaryData);
      setSummary(summaryData);

      // Extract previous day steps and last sync time from recent records
      if (summaryData?.recent_records && summaryData.recent_records.length > 0) {
        // Most recent record for last sync time
        const mostRecent = summaryData.recent_records[0];
        if (mostRecent.last_synced_at) {
          try {
            setLastSyncedAt(new Date(mostRecent.last_synced_at));
          } catch (e) {
            console.warn('Failed to parse last_synced_at:', e);
          }
        }

        // Find yesterday's record
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const yesterdayRecord = summaryData.recent_records.find(rec => {
          const recDate = new Date(rec.date).toISOString().split('T')[0];
          return recDate === yesterdayStr;
        });

        if (yesterdayRecord) {
          setPreviousDaySteps(yesterdayRecord.steps || 0);
          console.log('📅 Found yesterday record:', yesterdayRecord.steps, 'steps');
        }
      }
    } catch (summaryError) {
      console.error('❌ Failed to load summary:', summaryError);
      setSummary(null);
    }

    // Then check baseline
    try {
      const response = await api.checkStepBaseline();
      const exists = response?.has_baseline || false;
      
      console.log('📊 Baseline check result:', { exists });
      
      if (exists) {
        const baselineResponse = await getStepBaseline();
        console.log('📊 Baseline data fetched:', baselineResponse);
        
        // Extract baseline from response
        const baseline = baselineResponse?.data || baselineResponse;
        
        setHasBaseline(true);
        setBaselineData(baseline);
      } else {
        setHasBaseline(false);
        setBaselineData(null);
        
        Alert.alert(
          'Complete Activity Baseline',
          'Before tracking your steps, please complete a quick baseline assessment to establish your typical activity patterns.',
          [
            {
              text: 'Start Assessment',
              onPress: () => navigation.navigate('StepBaseline', { isEdit: false }),
            },
          ],
          { cancelable: false }
        );
      }
      
      return exists;
    } catch (baselineError) {
      console.log('⚠️ No baseline found:', baselineError);
      setHasBaseline(false);
      setBaselineData(null);
      return false;
    }
  } catch (error) {
    console.error('❌ Error in checkBaseline:', error);
    setHasBaseline(false);
    setBaselineData(null);
    setSummary(null);
    return false;
  }
};

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

  // Add this new function to show day details (add after formatDate function, around line 750):
const showDayDetails = useCallback((day) => {
  const date = new Date(day.date);
  const dateStr = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Calculate risk level
  let riskLevel = '';
  let riskColor = '';
  let riskMessage = '';
  let motivation = '';
  
  if (day.steps >= 10000) {
    riskLevel = '✅ Excellent';
    riskColor = 'success';
    riskMessage = 'You\'re significantly reducing your diabetes risk!';
    motivation = '🎉 Amazing work! You\'re in the optimal activity zone for metabolic health. Keep this up!';
  } else if (day.steps >= 7000) {
    riskLevel = '✓ Good';
    riskColor = 'info';
    riskMessage = 'You\'re on track for good metabolic health.';
    motivation = '💪 Great job! You\'re meeting the threshold for diabetes risk reduction. Try to reach 10,000 for maximum benefits!';
  } else if (day.steps >= 5000) {
    riskLevel = '⚠️ Moderate Risk';
    riskColor = 'warning';
    riskMessage = 'Your activity level could be better for metabolic health.';
    motivation = '👟 You\'re halfway there! Adding just 2,000 more steps (about 20 minutes of walking) would put you in the protective zone.';
  } else if (day.steps >= 2500) {
    riskLevel = '⚠️ High Risk';
    riskColor = 'warning';
    riskMessage = 'Low activity increases diabetes and metabolic syndrome risk.';
    motivation = '🚶 Every step counts! Try breaking up long sitting periods. Even 10-minute walks after meals help control blood sugar.';
  } else {
    riskLevel = '❌ Very High Risk';
    riskColor = 'danger';
    riskMessage = 'Sedentary lifestyle significantly increases diabetes risk.';
    motivation = '⚠️ Start small! Set a goal of 3,000 steps tomorrow. Park farther away, take stairs, or walk while on phone calls.';
  }
  
  // Build the message
  const goalProgress = Math.round((day.steps / DAILY_GOAL) * 100);
  
  let message = `📅 ${dateStr}\n\n`;
  message += `Steps: ${day.steps.toLocaleString()}\n`;
  message += `Distance: ${formatDistance(day.distance)}\n`;
  message += `Calories: ${Math.round(day.activeCalories || day.calories || 0)} kcal\n`;
  message += `Goal Progress: ${goalProgress}%\n\n`;
  message += `🎯 Risk Assessment\n`;
  message += `${riskLevel}\n\n`;
  message += `${riskMessage}\n\n`;
  message += `💡 Motivation\n`;
  message += `${motivation}`;
  
  Alert.alert(
    '📊 Daily Activity Details',
    message,
    [{ text: 'Got it!', style: 'default' }]
  );
}, [formatDistance]);

  // ADD THIS NEW FUNCTION
const getDataSourceLabel = (source) => {
  switch (source) {
    case 'health_connect':
      return { label: 'Health Connect', icon: 'google-fit', color: '#4CAF50' };
    case 'phone_sensor':
      return { label: 'Phone Sensor', icon: 'cellphone', color: colors.primary };
    case 'mixed':
      return { label: 'Mixed Sources', icon: 'source-merge', color: '#FF9800' };
    default:
      return { label: 'Unknown', icon: 'help-circle', color: colors.secondary };
  }
};

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

// ALSO UPDATE renderMetricsGrid (around line 800):
const renderMetricsGrid = useCallback(() => {
  console.log('🔍 renderMetricsGrid - Full summary:', JSON.stringify(summary, null, 2));
  
  // ✅ CORRECTED: summary already IS the data object
  const metrics = summary?.metrics || null;
  
  console.log('📊 Extracted metrics:', metrics);

  if (!metrics) {
    console.log('⚠️ No metrics found in summary');
    return null;
  }

  const showMetricDetail = (metricType, value, title) => {
    let message = '';
    let recommendation = '';
    
    switch (metricType) {
      case 'avg_7d':
        message = `Your 7-day average is ${Math.round(value).toLocaleString()} steps per day.\n\n`;
        if (value >= 10000) {
          message += '🎉 Excellent! You\'re meeting the recommended daily target.';
          recommendation = 'Keep up the great work! Consistency is key for long-term health.';
        } else if (value >= 7000) {
          message += '👍 Good! You\'re on track for metabolic health.';
          recommendation = 'Try to reach 10,000 steps daily for optimal benefits.';
        } else if (value >= 5000) {
          message += '💪 You\'re building a foundation.';
          recommendation = 'Gradually increase by 500-1,000 steps per week to reach 7,000+.';
        } else {
          message += '⚠️ Low activity may increase diabetes risk.';
          recommendation = 'Start with small goals: Add 1,000 steps daily this week. Try walking during phone calls or taking stairs.';
        }
        break;
        
      case 'avg_30d':
        message = `Your 30-day average is ${Math.round(value).toLocaleString()} steps per day.\n\n`;
        const change7to30 = ((metrics.avg_steps_7d - value) / value) * 100;
        if (change7to30 > 5) {
          message += '📈 You\'re trending upward! Your recent week shows improvement.';
        } else if (change7to30 < -5) {
          message += '📉 Recent activity has decreased. Let\'s refocus!';
        } else {
          message += '📊 Your activity level is steady.';
        }
        break;
        
      case 'active_days':
        message = `You were active on ${value} out of 30 days.\n\n`;
        const consistency = (value / 30) * 100;
        if (consistency >= 80) {
          message += '🔥 Amazing consistency!';
          recommendation = 'Your regular activity is protecting your metabolic health.';
        } else if (consistency >= 50) {
          message += '✓ Moderate consistency.';
          recommendation = 'Aim for 25+ active days per month (80%+) for best results.';
        } else {
          message += '⚠️ Low consistency detected.';
          recommendation = 'Try setting daily movement reminders. Even 10-minute walks count!';
        }
        break;
        
      case 'goal_days':
        message = `You met your daily goal on ${value} days this month.\n\n`;
        if (value >= 20) {
          message += '🏆 Outstanding! You\'re crushing your goals!';
          recommendation = 'Consider increasing your daily target by 1,000 steps.';
        } else if (value >= 10) {
          message += '👏 Good progress!';
          recommendation = 'Try to reach your goal 20+ days per month.';
        } else {
          message += '💪 Room for improvement.';
          recommendation = 'Focus on hitting your goal at least 10 days this month. Build the habit gradually.';
        }
        break;
    }
    
    Alert.alert(
      title,
      message + (recommendation ? '\n\n💡 Tip: ' + recommendation : ''),
      [{ text: 'Got it', style: 'default' }]
    );
  };

  return (
    <View style={styles.metricsGrid}>
      <View style={styles.metricCard}>
        <Icon name="walk" size={24} color={colors.primary} style={styles.metricIcon} />
        <Text style={styles.metricValue}>
          {Math.round(metrics.avg_steps_7d || 0).toLocaleString()}
        </Text>
        <Text style={styles.metricLabel}>Avg Steps (7 Days)</Text>
      </View>

      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>
          {Math.round(metrics.avg_steps_30d || 0).toLocaleString()}
        </Text>
        <Text style={styles.metricLabel}>Avg Steps (30 Days)</Text>
      </View>

      <View style={styles.metricCard}>
        <Icon name="calendar-check" size={24} color="#27AE60" style={styles.metricIcon} />
        <Text style={styles.metricValue}>
          {metrics.active_days_30d || 0}
        </Text>
        <Text style={styles.metricLabel}>Active Days (30d)</Text>
      </View>

      <View style={styles.metricCard}>
        <Icon name="trophy" size={24} color="#F39C12" style={styles.metricIcon} />
        <Text style={styles.metricValue}>
          {metrics.days_met_goal_30d || 0}
        </Text>
        <Text style={styles.metricLabel}>Goal Days (30d)</Text>
      </View>
    </View>
  );
}, [summary, colors]);

// Render risk assessment card
const renderRiskAssessment = useCallback(() => {
  const metrics = summary?.metrics;
  if (!metrics) return null;

  const score = metrics.risk_score ?? metrics.riskScore ?? 0;
  const category = metrics.risk_category || metrics.riskCategory || 'unknown';
  const factors = metrics.risk_factors || metrics.riskFactors || [];
  const avgSteps = Math.round(metrics.avg_steps_30d || 0);
  const daysTracked = metrics.days_with_data_30d || 0;

  const color = category === 'very_high' ? '#E74C3C' : category === 'high' ? '#F39C12' : category === 'moderate' ? '#FF9800' : '#27AE60';

  // Generate explanation
  let explanation = '';
  if (avgSteps < 3000) {
    explanation = `Very low activity (${avgSteps.toLocaleString()} avg steps) significantly increases diabetes risk. Sedentary lifestyle is strongly linked to insulin resistance.`;
  } else if (avgSteps < 5000) {
    explanation = `Low activity level (${avgSteps.toLocaleString()} avg steps). Studies show 5,000+ steps/day reduces diabetes risk. Your current level carries elevated risk.`;
  } else if (avgSteps < 7000) {
    explanation = `Moderate activity (${avgSteps.toLocaleString()} avg steps). You're on the right track! Reaching 7,000+ steps provides stronger diabetes protection.`;
  } else if (avgSteps < 10000) {
    explanation = `Good activity level (${avgSteps.toLocaleString()} avg steps). Evidence shows 7,000+ steps significantly reduce diabetes risk. Keep it up!`;
  } else {
    explanation = `Excellent activity (${avgSteps.toLocaleString()} avg steps)! 10,000+ steps/day provides strong metabolic protection and reduces diabetes risk.`;
  }

  if (daysTracked < 7) {
    explanation += ` Assessment is preliminary (${daysTracked} days tracked). Track for 2+ weeks for reliable risk estimate.`;
  }

  return (
    <View style={styles.riskCard}>
      <View style={styles.riskHeader}>
        <Text style={styles.riskTitle}>Diabetes Risk Assessment</Text>
        <View style={[styles.riskBadge, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[styles.riskScore, { color }]}>{score}</Text>
        </View>
      </View>
      <Text style={[styles.riskCategory, { color }]}>{category.replace('_', ' ').toUpperCase()}</Text>
      <Text style={styles.riskExplanation}>{explanation}</Text>
      {factors.length > 0 && (
        <View style={styles.riskFactors}>
          <Text style={styles.riskFactorsTitle}>Risk Factors:</Text>
          {factors.map((f, i) => (
            <Text key={`f-${i}`} style={styles.riskFactor}>{'• ' + f.replace('_', ' ')}</Text>
          ))}
        </View>
      )}
      <Text style={styles.riskNote}>Based on 30-day activity patterns and baseline assessment. Regular physical activity improves insulin sensitivity.</Text>
    </View>
  );
}, [summary, colors]);

// REPLACE renderRetakeBaseline (around line 600):
const renderRetakeBaseline = () => {
  if (!hasBaseline || !baselineData) return null;

  return (
    <TouchableOpacity
      style={styles.retakeBaselineButton}
      onPress={() => {
        console.log('🔄 Retake baseline pressed');
        console.log('📊 Passing baseline data:', baselineData);
        
        navigation.navigate('StepBaseline', { 
          baseline: baselineData,
          isEdit: true 
        });
      }}
      accessibilityRole="button"
      accessibilityLabel="Update your activity baseline"
    >
      <Icon name="refresh" size={16} color={colors.secondary} />
      <Text style={styles.retakeBaselineText}>Update Activity Baseline</Text>
    </TouchableOpacity>
  );
};

// Education Card
const renderEducationCard = () => (
  <View style={styles.educationCard}>
    <Text style={styles.educationTitle}>📊 Why Track Steps?</Text>
    <Text style={styles.educationText}>
      Regular physical activity helps improve insulin sensitivity and reduce diabetes risk.
    </Text>
    <View style={styles.educationBullet}>
      <Icon name="check-circle" size={16} color={colors.primary} />
      <Text style={styles.educationBulletText}>
        <Text style={{ fontWeight: '600' }}>7,000+ steps/day</Text> reduces diabetes risk
      </Text>
    </View>
    <View style={styles.educationBullet}>
      <Icon name="check-circle" size={16} color={colors.primary} />
      <Text style={styles.educationBulletText}>
        <Text style={{ fontWeight: '600' }}>Consistency</Text> matters more than daily peaks
      </Text>
    </View>
    <View style={styles.educationBullet}>
      <Icon name="check-circle" size={16} color={colors.primary} />
      <Text style={styles.educationBulletText}>
        <Text style={{ fontWeight: '600' }}>Low activity (&lt;5,000)</Text> increases metabolic risk
      </Text>
    </View>
  </View>
);


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

  // Render recent synced records (max 7)
  const renderRecentSynced = useCallback(() => {
    const records = summary?.recent_records || [];
    if (!records || records.length === 0) return null;

    const display = records.slice(0, 7);

    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>Recent Synced Days</Text>
        {display.map((rec, idx) => (
          <View key={`rec-${idx}`} style={styles.dailyCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.dailyDate}>{formatDate(rec.date)}</Text>
              <Text style={styles.dailySteps}>{(rec.steps || 0).toLocaleString()} steps</Text>
            </View>
            <View style={styles.dailyMetrics}>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>{formatDistance(rec.distance || 0)}</Text>
                <Text style={styles.dailyMetricLabel}>Distance</Text>
              </View>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>{Math.round(rec.active_calories || rec.activeCalories || 0)}</Text>
                <Text style={styles.dailyMetricLabel}>Active Cal</Text>
              </View>
              <View style={styles.dailyMetric}>
                <Text style={styles.dailyMetricValue}>{new Date(rec.date).toLocaleString()}</Text>
                <Text style={styles.dailyMetricLabel}>Date/Time</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }, [summary, formatDate, formatDistance]);

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
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Steps Overview</Text>
        <Text style={styles.chartSubtitle}>Tap any bar for details</Text>
      </View>
      <View style={styles.chartContainer}>
        <View style={styles.chartBars}>
          {displayData.map((day, index) => {
            const height = (day.steps / maxSteps) * 160;
            const barColor = day.steps >= DAILY_GOAL ? '#27AE60' : 
                           day.steps >= 7000 ? '#F39C12' : 
                           day.steps >= 5000 ? '#FF9800' : 
                           '#E74C3C';
            
            return (
              <TouchableOpacity
                key={`bar-${index}`}
                style={styles.chartBarContainer}
                onPress={() => showDayDetails(day)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: Math.max(height, 2),
                      backgroundColor: barColor,
                      opacity: day.steps > 0 ? 0.8 : 0.3,
                    },
                  ]}
                />
              </TouchableOpacity>
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
      
      {/* Color Legend */}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#27AE60' }]} />
          <Text style={styles.legendText}>10,000+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F39C12' }]} />
          <Text style={styles.legendText}>7,000+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>5,000+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E74C3C' }]} />
          <Text style={styles.legendText}>&lt;5,000</Text>
        </View>
      </View>
    </View>
  );
}, [selectedPeriod, activityData.dailyData, maxSteps, showDayDetails, formatDistance]);


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
              <Text style={styles.dailyMetricValue}>
                {Math.round(day.activeCalories || day.calories || 0)}
              </Text>
              <Text style={styles.dailyMetricLabel}>Active Cal</Text>
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
    // ADD ALL THESE NEW STYLES HERE
// Data Source Card
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
// Retake Baseline
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
previousDayText: {
  fontSize: 13,
  color: colors.secondary,
  marginTop: 6,
},
// Risk Assessment Card
riskCard: {
  backgroundColor: colors.card,
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: colors.border,
},
riskHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},
riskTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: colors.text,
  flex: 1,
},
riskBadge: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
  borderWidth: 2,
},
riskScore: {
  fontSize: 24,
  fontWeight: '700',
},
riskCategory: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 12,
},
riskExplanation: {
  fontSize: 14,
  lineHeight: 22,
  color: colors.text,
  marginBottom: 12,
},
riskFactors: {
  marginTop: 8,
  marginBottom: 12,
},
riskFactorsTitle: {
  fontSize: 13,
  fontWeight: '600',
  color: colors.secondary,
  marginBottom: 4,
},
riskFactor: {
  fontSize: 13,
  color: colors.secondary,
  marginLeft: 8,
  lineHeight: 20,
},
riskNote: {
  fontSize: 11,
  color: colors.secondary,
  fontStyle: 'italic',
  marginTop: 8,
},
// Education Card
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
},educationBulletText: {
  flex: 1,
  fontSize: 13,
  color: colors.text,
  marginLeft: 8,
  lineHeight: 20,
},
     chartCard: { 
    backgroundColor: colors.card, 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  chartHeader: { 
    marginBottom: 16 
  },
  chartTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.text 
  },
  chartSubtitle: { 
    fontSize: 12, 
    color: colors.secondary, 
    marginTop: 4 
  },
  chartContainer: { 
    height: 200 
  },
  chartBars: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    justifyContent: 'space-between', 
    height: 160, 
    paddingHorizontal: 8 
  },
  chartBarContainer: { 
    flex: 1, 
    marginHorizontal: 2, 
    alignItems: 'center', 
    justifyContent: 'flex-end' 
  },
  chartBar: { 
    width: '100%', 
    borderRadius: 4, 
    minHeight: 2 
  },
  chartLabels: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 8, 
    paddingHorizontal: 8 
  },
  chartLabel: { 
    fontSize: 10, 
    color: colors.secondary, 
    flex: 1, 
    textAlign: 'center' 
  },
    chartLegend: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginTop: 16, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: colors.border 
  },
  legendItem: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  legendDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    marginRight: 4 
  },
  legendText: { 
    fontSize: 11, 
    color: colors.secondary 
  },
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
              {selectedPeriod === 'today' && previousDaySteps != null && (
                <Text style={styles.previousDayText}>Yesterday: {previousDaySteps.toLocaleString()} steps</Text>
              )}
              {lastSyncedAt && (
                <Text style={styles.previousDayText}>Last sync: {lastSyncedAt.toLocaleString()}</Text>
              )}
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

        {/* ADD THESE NEW COMPONENTS HERE */}
        {renderMetricsGrid()}
        {renderRetakeBaseline()}



        {renderStreakBadge()}
        {renderHealthInsights()}
        {renderRecentSynced()}
        {renderRiskAssessment()}
        {renderAchievements()}
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

        {/* AI-Powered Timeline Predictions */}
        <LifestyleRecommendationsSection trackerType="activity" />
                {renderEducationCard()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StepCounterScreen;