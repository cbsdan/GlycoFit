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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import healthConnectManager, {
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
    if (isInitialized && hasPermissions && healthData) {
      fetchHealthData();
    }
  }, [selectedPeriod]);

  const initializeHealthConnect = async () => {
    try {
      setIsLoading(true);
      await initHealthConnect();
      setIsInitialized(true);
      
      const status = await healthConnectManager.getSdkStatus();
      console.log('🔍 Health Connect SDK Status:', status);
      
      if (healthConnectManager.isSdkAvailable()) {
        toast.success('Health Connect initialized successfully!');
      } else {
        toast.error(`Health Connect not available: ${healthConnectManager.getSdkStatusDescription()}`);
      }
    } catch (error) {
      console.error('Failed to initialize Health Connect:', error);
      toast.error('Failed to initialize Health Connect: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      setIsLoading(true);
      const permissions = await requestAllHealthPermissions();
      
      console.log('📋 Permission Results:', permissions);
      
      // Check if permissions is an array (granted permissions) or object
      let grantedCount = 0;
      let totalCount = 16; // We requested 16 permissions
      
      if (Array.isArray(permissions)) {
        grantedCount = permissions.length;
        console.log('✅ Granted Permissions:', permissions.map(p => p.recordType).join(', '));
      } else if (typeof permissions === 'object') {
        grantedCount = Object.values(permissions).filter(Boolean).length;
      }
      
      if (grantedCount > 0) {
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
      console.error('Failed to request permissions:', error);
      toast.error('Failed to request permissions: ' + error.message);
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

      // Fetch all categories of health data
      const [activity, vitals, bodyMeasurements, sleep, nutrition] = await Promise.all([
        getActivityData(startDate, endDate),
        getVitalsData(startDate, endDate),
        getBodyMeasurementsData(startDate, endDate),
        getSleepData(startDate, endDate),
        getNutritionData(startDate, endDate),
      ]);

      console.log('📊 Activity Data:', {
        steps: Array.isArray(activity?.steps) ? activity.steps.length : 0,
        distance: Array.isArray(activity?.distance) ? activity.distance.length : 0,
        activeCalories: Array.isArray(activity?.activeCalories) ? activity.activeCalories.length : 0,
      });

      const allData = {
        activity,
        vitals,
        bodyMeasurements,
        sleep,
        nutrition,
        fetchedAt: new Date().toISOString(),
      };

      setHealthData(allData);
      toast.success('Health data loaded successfully!');
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

  const renderDataCard = (title, icon, iconColor, data, dataKey) => {
    // Handle both direct array and nested object structures
    let value = 0;
    
    if (data && dataKey) {
      const records = data[dataKey];
      if (Array.isArray(records)) {
        value = records.length;
      } else if (records && typeof records === 'object' && Array.isArray(records.records)) {
        // Handle case where data might be { records: [...] }
        value = records.records.length;
      }
    }
    
    return (
      <View style={[styles.dataCard, { borderColor: colors.border }]}>
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Icon name={icon} size={24} color={iconColor} />
        </View>
        <Text style={[styles.dataTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.dataValue, { color: colors.primary }]}>
          {value} records
        </Text>
      </View>
    );
  };

  const renderSummaryCard = (title, value, unit, icon, iconColor) => {
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

  const getLatestWeight = () => {
    if (!healthData?.bodyMeasurements?.weight || 
        !Array.isArray(healthData.bodyMeasurements.weight) ||
        healthData.bodyMeasurements.weight.length === 0) 
      return '--';
    const latest = healthData.bodyMeasurements.weight[0];
    return latest.weight?.inKilograms?.toFixed(1) || '--';
  };

  const getLatestHeartRate = () => {
    if (!healthData?.vitals?.heartRate || 
        !Array.isArray(healthData.vitals.heartRate) ||
        healthData.vitals.heartRate.length === 0) 
      return '--';
    const latest = healthData.vitals.heartRate[0];
    return latest.beatsPerMinute || '--';
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
                {renderSummaryCard(
                  'Weight',
                  getLatestWeight(),
                  'kg',
                  'weight-kilogram',
                  '#2196F3'
                )}
                {renderSummaryCard(
                  'Heart Rate',
                  getLatestHeartRate(),
                  'bpm',
                  'heart-pulse',
                  '#E91E63'
                )}
              </View>
            </View>

            {/* Activity Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Steps', 'walk', '#4CAF50', healthData.activity, 'steps')}
                {renderDataCard('Distance', 'map-marker-distance', '#2196F3', healthData.activity, 'distance')}
                {renderDataCard('Active Calories', 'fire', '#FF5722', healthData.activity, 'activeCalories')}
                {renderDataCard('Exercise', 'dumbbell', '#9C27B0', healthData.activity, 'exerciseSessions')}
              </View>
            </View>

            {/* Vitals Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vitals</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Heart Rate', 'heart-pulse', '#E91E63', healthData.vitals, 'heartRate')}
                {renderDataCard('Blood Pressure', 'blood-bag', '#F44336', healthData.vitals, 'bloodPressure')}
                {renderDataCard('Blood Glucose', 'water', '#00BCD4', healthData.vitals, 'bloodGlucose')}
                {renderDataCard('Oxygen', 'air-filter', '#03A9F4', healthData.vitals, 'oxygenSaturation')}
              </View>
            </View>

            {/* Body Measurements Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Body Measurements</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Weight', 'weight-kilogram', '#2196F3', healthData.bodyMeasurements, 'weight')}
                {renderDataCard('Height', 'human-male-height', '#607D8B', healthData.bodyMeasurements, 'height')}
                {renderDataCard('Body Fat', 'gauge', '#FF9800', healthData.bodyMeasurements, 'bodyFat')}
              </View>
            </View>

            {/* Sleep Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sleep</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Sleep Sessions', 'sleep', '#673AB7', { sleep: healthData.sleep }, 'sleep')}
              </View>
            </View>

            {/* Nutrition Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutrition</Text>
              <View style={styles.dataGrid}>
                {renderDataCard('Meals', 'food-apple', '#8BC34A', healthData.nutrition, 'nutrition')}
                {renderDataCard('Hydration', 'water', '#00BCD4', healthData.nutrition, 'hydration')}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default HealthDataScreen;
