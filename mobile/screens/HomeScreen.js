import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { getStepSummary } from '../services/api';
import {
  healthConnectManager,
  getTodayData,
  getThisWeekData,
  getActivityData,
} from '../services/healthConnectService';
import stepDetectionService from '../services/stepDetectionService';
import HealthMetricsSetupScreen from './HealthMetricsSetupScreen';
import ChatBotBubble from '../components/ChatBotBubble';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState([]);
  const [nutritionData, setNutritionData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [weeklyHealthData, setWeeklyHealthData] = useState(null);
  const [monthlyHealthData, setMonthlyHealthData] = useState(null);
  const [healthConnectAvailable, setHealthConnectAvailable] = useState(false);
  const [showHealthMetricsPrompt, setShowHealthMetricsPrompt] = useState(false);
  const [showHealthMetricsModal, setShowHealthMetricsModal] = useState(false);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [isDiagnosed, setIsDiagnosed] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async (forceRefresh = false) => {
    try {
      // Only show the full-screen spinner on the very first load.
      // Pull-to-refresh uses isRefreshing, so we must not replace the whole
      // screen with the loader or the RefreshControl animation never clears.
      if (!forceRefresh) setIsLoading(true);
      console.log('🏠 HomeScreen: Loading dashboard data...', forceRefresh ? '(force refresh)' : '');
      console.log('👤 Current user:', user?.uid || 'NO USER');
      
      // Note: API calls below are automatically cached via CacheService
      // Fresh data is fetched only if cache is stale (configurable per endpoint)
      // Pass forceRefresh to bypass cache when user pulls to refresh
      
      // Check profile completion first
      const isProfileComplete = await checkProfileCompletion();
      
      // Only load other data if profile is complete
      if (isProfileComplete) {
        await Promise.all([
          fetchNutritionData(forceRefresh),
          fetchHealthData(forceRefresh),
          checkHealthMetricsStatus(forceRefresh),
        ]);
      }
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNutritionData = async (forceRefresh = false) => {
    try {
      // Get today's date range (same logic as MealHistoryScreen)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startDate = today.toISOString();
      const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
      
      // Fetch meals for today (same as MealHistoryScreen approach)
      const response = await api.getUserMeals(50, 0, startDate, endDate, forceRefresh);
      
      console.log('Meals Response:', response);
      
      if (response.success && response.data && response.data.meals) {
        const meals = response.data.meals;
        console.log('Today\'s meals:', meals.length);
        
        // Calculate totals from meals (same logic as MealHistoryScreen)
        const totals = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        };

        meals.forEach((meal) => {
          if (meal.nutrients) {
            totals.calories += parseFloat(meal.nutrients.calories || meal.nutrients.Calories || 0);
            totals.protein += parseFloat(meal.nutrients.protein || meal.nutrients['Protein (g)'] || 0);
            totals.carbs += parseFloat(meal.nutrients.carbohydrates || meal.nutrients.carbs || meal.nutrients['Carbs (g)'] || 0);
            totals.fat += parseFloat(meal.nutrients.fat || meal.nutrients['Fat (g)'] || 0);
          }
        });

        console.log('Calculated nutrition totals:', totals);
        
        // Set data in the same structure expected by the UI
        setNutritionData({
          total_nutrients: totals,
          meal_count: meals.length
        });
      } else {
        setNutritionData(null);
      }
    } catch (error) {
      console.log('Error fetching nutrition data:', error);
      setNutritionData(null);
    }
  };

  const fetchHealthData = async (forceRefresh = false) => {
    try {
      let stepsData = null;
      
      // 1. First, try to get steps from backend (step tracking API)
      try {
        console.log('📡 Calling getStepSummary(30)...');
        const summary = await getStepSummary(30, forceRefresh); // Changed from 7 to 30 days
        console.log('📊 Step summary response:', JSON.stringify(summary, null, 2));
        
        // Check if response is wrapped in data object
        const summaryData = summary?.data || summary;
        console.log('📊 Summary data:', summaryData);
        
        if (summaryData?.recent_records && summaryData.recent_records.length > 0) {
          console.log('✅ Found recent_records:', summaryData.recent_records.length, 'records');
          // Only use a record if it is actually from today — same date-check as StepCounterScreen
          const todayStr = new Date().toISOString().split('T')[0];
          const todayRecord = summaryData.recent_records.find(
            r => new Date(r.date).toISOString().split('T')[0] === todayStr
          );
          console.log('📊 Today record:', todayRecord || 'none');

          if (todayRecord && todayRecord.steps > 0) {
            stepsData = {
              steps: todayRecord.steps,
              source: 'backend',
              date: todayRecord.date
            };
            console.log('✅ Got today\'s steps from backend:', stepsData);
          } else {
            console.log('⚠️ No backend record for today — steps will show N/A or from sensor');
          }
        } else {
          console.log('⚠️ Backend returned empty or no recent_records');
          console.log('   Summary structure:', Object.keys(summaryData || {}));
        }
      } catch (backendError) {
        console.log('⚠️ Backend step summary failed:', backendError);
        console.log('   Error details:', backendError.message);
      }
      
      // 2. If backend failed, try Health Connect as fallback
      if (!stepsData || stepsData.steps === 0) {
        console.log('🔄 Trying Health Connect fallback...');
        try {
          // Initialize Health Connect first
          await healthConnectManager.initialize();
          const sdkStatus = await healthConnectManager.getSdkStatus();
          const isAvailable = sdkStatus === 1; // SdkAvailabilityStatus.SDK_AVAILABLE = 1
          setHealthConnectAvailable(isAvailable);
          console.log('📱 Health Connect SDK status:', sdkStatus, '(available:', isAvailable, ')');
          
          if (isAvailable) {
            const todayData = await getTodayData();
            console.log('📱 Health Connect data:', todayData);
            
            if (todayData?.steps > 0) {
              stepsData = {
                steps: todayData.steps,
                source: 'healthConnect'
              };
              console.log('✅ Got steps from Health Connect:', stepsData);
            }
          }
        } catch (hcError) {
          console.log('⚠️ Health Connect failed:', hcError.message || hcError);
        }
      }
      
      // 3. Set the health data with steps (or null if no data)
      if (stepsData && stepsData.steps > 0) {
        setHealthData({
          steps: stepsData.steps,
          source: stepsData.source,
          date: stepsData.date
        });
        console.log('✅ Final healthData set:', { steps: stepsData.steps, source: stepsData.source });
      } else {
        setHealthData(null);
        console.log('⚠️ No steps data available from any source');
      }
      
      // Also try to fetch backend API statistics for other health metrics (optional)
      try {
        const dailyResponse = await api.getStatisticsSummary('day', null, forceRefresh);
        if (dailyResponse.success && dailyResponse.data) {
          setHealthData(prev => ({
            ...dailyResponse.data,
            ...prev // Keep steps data from above if available (prioritize it)
          }));
        }
      } catch (apiError) {
        console.log('ℹ️ Statistics summary not available:', apiError.message);
      }

      // Fetch weekly data for fallback
      try {
        const weeklyResponse = await api.getStatisticsSummary('week', null, forceRefresh);
        if (weeklyResponse.success && weeklyResponse.data) {
          setWeeklyHealthData(weeklyResponse.data);
        }
      } catch (weeklyError) {
        console.log('ℹ️ Weekly data not available:', weeklyError.message);
      }

      // Fetch monthly data for fallback
      try {
        const monthlyResponse = await api.getStatisticsSummary('month', null, forceRefresh);
        if (monthlyResponse.success && monthlyResponse.data) {
          setMonthlyHealthData(monthlyResponse.data);
        }
      } catch (monthlyError) {
        console.log('ℹ️ Monthly data not available:', monthlyError.message);
      }
    } catch (error) {
      console.error('❌ Error in fetchHealthData:', error);
      setHealthData(null);
    }
  };

  const checkHealthMetricsStatus = async (forceRefresh = false) => {
    try {
      // Don't show health metrics prompt if user is already diagnosed
      if (isDiagnosed) {
        setShowHealthMetricsPrompt(false);
        return;
      }

      const response = await api.getHealthMetrics(forceRefresh);
      const metrics = response?.health_metrics;
      
      // Check if all required metrics are set
      const hasAllMetrics = metrics && 
        metrics.age !== null && metrics.age !== undefined &&
        metrics.sex !== null && metrics.sex !== undefined &&
        metrics.height !== null && metrics.height !== undefined &&
        metrics.weight !== null && metrics.weight !== undefined;
      
      // Show prompt if metrics are incomplete
      setShowHealthMetricsPrompt(!hasAllMetrics);
    } catch (error) {
      console.log('Error checking health metrics:', error);
      // If there's an error (like 404), show the prompt only if not diagnosed
      setShowHealthMetricsPrompt(!isDiagnosed);
    }
  };

  const checkProfileCompletion = async () => {
    try {
      // Check if user has completed their profile (especially diagnosis_status)
      const diagnosisStatus = user?.diagnosis_status;
      
      // Check if diagnosis_status is set
      const hasProfileComplete = diagnosisStatus && 
        diagnosisStatus !== '' && 
        diagnosisStatus !== null && 
        diagnosisStatus !== undefined;
      
      if (!hasProfileComplete) {
        setShowProfilePrompt(true);
        setShowHealthMetricsPrompt(false);
        return false;
      }
      
      // Check if user is diagnosed with prediabetes or type 2 diabetes
      const diagnosed = diagnosisStatus === 'prediabetes' || diagnosisStatus === 'type2_diabetes';
      setIsDiagnosed(diagnosed);
      setShowProfilePrompt(false);
      
      console.log('✅ Profile completion check:', {
        diagnosisStatus,
        isDiagnosed: diagnosed,
        profileComplete: hasProfileComplete
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error checking profile completion:', error);
      setShowProfilePrompt(true);
      return false;
    }
  };

  const handleCompleteProfile = async () => {
    // Navigate to ProfileScreen for user to complete diagnosis_status
    navigation.navigate('Profile');
  };

  const handleHealthMetricsSetup = async () => {
    // Clear the skip flag so user can complete it
    await AsyncStorage.removeItem('@health_metrics_skipped');
    // Show the health metrics modal
    setShowHealthMetricsModal(true);
  };

  const handleHealthMetricsComplete = async () => {
    setShowHealthMetricsModal(false);
    setShowHealthMetricsPrompt(false);
    // Refresh dashboard to reflect new data
    await loadDashboardData();
    toast.success('Health metrics saved successfully!');
  };

  useEffect(() => {
    const stats = [];

    // Helper function to get value with fallback (daily -> weekly -> monthly -> N/A)
    const getValueWithFallback = (dailyData, weeklyData, monthlyData, key, subKey = null) => {
      // Try daily first
      if (dailyData && dailyData[key]) {
        const value = subKey ? dailyData[key][subKey] : dailyData[key];
        if (value !== null && value !== undefined && value > 0) {
          return { value, period: 'today' };
        }
      }
      
      // Try weekly
      if (weeklyData && weeklyData[key]) {
        const value = subKey ? weeklyData[key][subKey] : weeklyData[key];
        if (value !== null && value !== undefined && value > 0) {
          return { value, period: 'this week' };
        }
      }
      
      // Try monthly
      if (monthlyData && monthlyData[key]) {
        const value = subKey ? monthlyData[key][subKey] : monthlyData[key];
        if (value !== null && value !== undefined && value > 0) {
          return { value, period: 'this month' };
        }
      }
      
      return { value: null, period: null };
    };

    // 1. Carbs from nutrition (daily only)
    const carbsData = nutritionData?.total_nutrients?.carbs || 0;
    console.log('Carbs Data:', carbsData, 'Full nutrition:', nutritionData?.total_nutrients);
    
    stats.push({
      id: 'carbs',
      title: 'Carbs Today',
      value: carbsData > 0 ? Math.round(carbsData).toLocaleString() : 'N/A',
      unit: carbsData > 0 ? 'g' : '',
      status: 'good',
      icon: 'grain',
      color: '#F39C12',
      onPress: () => navigation.navigate('MealHistory'),
    });

    // 2. Calories Burned - Calculate from steps
    let caloriesBurned = 'N/A';
    let caloriesPeriod = 'today';
    
    console.log('🔍 HomeScreen stats - healthData:', healthData);
    
    // Get steps from healthData (direct value)
    const todaySteps = healthData?.steps || 0;
    
    if (todaySteps > 0) {
      // Calculate calories from steps
      const totalCalories = stepDetectionService.calculateCalories(todaySteps);
      caloriesBurned = totalCalories * 0.7; // ~70% as active calories
      console.log('🔥 Calculated', caloriesBurned, 'active calories from', todaySteps, 'steps');
    } else {
      console.log('⚠️ No steps data - showing N/A for calories');
    }
    
    stats.push({
      id: 'calories-burned',
      title: caloriesBurned !== 'N/A' ? `Calories (${caloriesPeriod})` : 'Calories Burned',
      value: caloriesBurned !== 'N/A' ? Math.round(caloriesBurned).toLocaleString() : 'N/A',
      unit: caloriesBurned !== 'N/A' ? 'kcal' : '',
      status: 'good',
      icon: 'fire-circle',
      color: '#E74C3C',
      onPress: () => navigation.navigate('SyncedHealthData'),
    });

    // 3. Steps - Get from healthData
    const steps = todaySteps > 0 ? todaySteps : 'N/A';
    const stepsPeriod = steps !== 'N/A' ? 'today' : '';
    
    console.log('👣 Steps for display:', steps, stepsPeriod ? `(${stepsPeriod})` : '');
    
    stats.push({
      id: 'steps',
      title: stepsPeriod ? `Steps (${stepsPeriod})` : 'Steps',
      value: steps !== 'N/A' ? Math.round(steps).toLocaleString() : 'N/A',
      unit: steps !== 'N/A' ? 'steps' : '',
      status: 'good',
      icon: 'walk',
      color: '#3498DB',
      onPress: () => navigation.navigate('SyncedHealthData'),
    });

    // 4. Calories Consumed from nutrition (daily only)
    const caloriesConsumed = nutritionData?.total_nutrients?.calories || 0;
    stats.push({
      id: 'calories-consumed',
      title: 'Calories Today',
      value: caloriesConsumed > 0 ? Math.round(caloriesConsumed).toLocaleString() : 'N/A',
      unit: caloriesConsumed > 0 ? 'kcal' : '',
      status: 'good',
      icon: 'food-apple',
      color: '#27AE60',
      onPress: () => navigation.navigate('MealHistory'),
    });

    setTodayStats(stats);
  }, [nutritionData, healthData, weeklyHealthData, monthlyHealthData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardData(true); // Force refresh to bypass cache
    } finally {
      setIsRefreshing(false);
    }
  };

  const quickActions = [
    {
      id: 'food',
      title: 'Meal Records',
      subtitle: 'Monitor your meals',
      icon: 'food',
      color: '#F39C12',
      action: () => navigation.navigate('MealHistory'),
    },
    {
      id: 'insights',
      title: 'View Insights',
      subtitle: 'Check predictions',
      icon: 'chart-line',
      color: '#3498DB',
      action: () => navigation.navigate('AssessmentResults'),
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'normal':
      case 'good':
        return '#27AE60';
      case 'warning':
        return '#F39C12';
      case 'high':
        return '#E74C3C';
      default:
        return colors.secondary;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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
    greeting: {
      fontSize: 16,
      color: colors.secondary,
      marginBottom: 4,
    },
    welcomeText: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    userName: {
      color: colors.primary,
    },
    statsSection: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...colors.shadow,
    },
    statHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    statTitle: {
      fontSize: 12,
      color: colors.secondary,
      flex: 1,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    statUnit: {
      fontSize: 12,
      color: colors.secondary,
    },
    statusIndicator: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    quickActionsSection: {
      marginBottom: 32,
    },
    actionsList: {
      gap: 12,
    },
    actionCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    actionSubtitle: {
      fontSize: 13,
      color: colors.secondary,
    },
    actionArrow: {
      marginLeft: 12,
    },
    recentSection: {
      marginBottom: 24,
    },
    recentList: {
      gap: 12,
    },
    recentCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    recentContent: {
      flex: 1,
    },
    recentTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    recentTime: {
      fontSize: 12,
      color: colors.secondary,
    },
    recentValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
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
    },
    healthMetricsPrompt: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      ...colors.shadow,
    },
    promptIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    promptContent: {
      flex: 1,
    },
    promptTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    promptSubtitle: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.85)',
      lineHeight: 18,
    },
    promptArrow: {
      marginLeft: 8,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.welcomeText}>
            <Text style={styles.userName}>
              {user?.first_name?.split(' ')[0] || 'User'} {user?.last_name?.split(' ')[0] || ''}
            </Text>
          </Text>
        </View>

        {/* Profile Completion Prompt Banner */}
        {showProfilePrompt && (
          <TouchableOpacity
            style={styles.healthMetricsPrompt}
            onPress={handleCompleteProfile}
            activeOpacity={0.8}
          >
            <View style={styles.promptIconContainer}>
              <Icon name="account-edit" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.promptContent}>
              <Text style={styles.promptTitle}>Complete Your Profile</Text>
              <Text style={styles.promptSubtitle}>
                Please complete your profile to access all features
              </Text>
            </View>
            <View style={styles.promptArrow}>
              <Icon name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Health Metrics Prompt Banner (only show if profile complete and not diagnosed) */}
        {!showProfilePrompt && showHealthMetricsPrompt && !isDiagnosed && (
          <TouchableOpacity
            style={styles.healthMetricsPrompt}
            onPress={handleHealthMetricsSetup}
            activeOpacity={0.8}
          >
            <View style={styles.promptIconContainer}>
              <Icon name="account-details" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.promptContent}>
              <Text style={styles.promptTitle}>Complete Your Health Profile</Text>
              <Text style={styles.promptSubtitle}>
                Add your health metrics for personalized insights
              </Text>
            </View>
            <View style={styles.promptArrow}>
              <Icon name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Today's Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Today's Overview</Text>
          <View style={styles.statsGrid}>
            {todayStats.map((stat) => (
              <TouchableOpacity
                key={stat.id}
                style={styles.statCard}
                onPress={stat.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.statusIndicator, { backgroundColor: stat.value === 'N/A' ? colors.border : getStatusColor(stat.status) }]} />
                
                <View style={styles.statHeader}>
                  <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                    <Icon name={stat.icon} size={18} color={stat.color} />
                  </View>
                  <Text style={styles.statTitle}>{stat.title}</Text>
                </View>

                <Text style={styles.statValue}>
                  {stat.value}
                  {stat.unit && <Text style={styles.statUnit}> {stat.unit}</Text>}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsList}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionCard}
                onPress={action.action}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
                  <Icon name={action.icon} size={24} color={action.color} />
                </View>
                
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                </View>
                
                <View style={styles.actionArrow}>
                  <Icon name="chevron-right" size={20} color={colors.secondary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* Health Metrics Setup Modal */}
      <Modal
        visible={showHealthMetricsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHealthMetricsModal(false)}
      >
        <HealthMetricsSetupScreen
          onComplete={handleHealthMetricsComplete}
          onSkip={() => setShowHealthMetricsModal(false)}
        />
      </Modal>
      
      {/* ChatBot Floating Bubble */}
      <ChatBotBubble onPress={() => navigation.navigate('ChatBot')} />
    </SafeAreaView>
  );
};

export default HomeScreen;
