import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  getHealthData,
  getDailyStatistics,
  getWeeklyStatistics,
  getMonthlyStatistics,
  getStatisticsSummary,
} from '../services/api';

const { width } = Dimensions.get('window');

const SyncedHealthDataScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState('steps'); // steps (steps + calories), sleep
  const [selectedPeriod, setSelectedPeriod] = useState('daily'); // daily, weekly, monthly
  const [statistics, setStatistics] = useState(null);
  const [stepsStats, setStepsStats] = useState(null);
  const [caloriesStats, setCaloriesStats] = useState(null);
  const [recentData, setRecentData] = useState([]);

  useEffect(() => {
    fetchData();
  }, [selectedDataType, selectedPeriod]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch statistics and recent records in parallel for better performance
      // Use local date format to avoid timezone conversion issues
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      
      const promises = [];
      
      // For steps tab, fetch both steps and calories statistics
      if (selectedDataType === 'steps') {
        // Fetch steps statistics
        if (selectedPeriod === 'daily') {
          promises.push(getDailyStatistics('steps', today));
          promises.push(getDailyStatistics('active_calories', today));
        } else if (selectedPeriod === 'weekly') {
          const now = new Date();
          const currentDay = now.getDay();
          const isEarlyWeek = currentDay <= 2;
          const daysToSubtract = isEarlyWeek ? currentDay + 7 : currentDay;
          const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
          const year = weekStart.getFullYear();
          const month = String(weekStart.getMonth() + 1).padStart(2, '0');
          const day = String(weekStart.getDate()).padStart(2, '0');
          const startDateStr = `${year}-${month}-${day}`;
          promises.push(getWeeklyStatistics('steps', startDateStr));
          promises.push(getWeeklyStatistics('active_calories', startDateStr));
        } else if (selectedPeriod === 'monthly') {
          const now = new Date();
          promises.push(getMonthlyStatistics('steps', now.getFullYear(), now.getMonth() + 1));
          promises.push(getMonthlyStatistics('active_calories', now.getFullYear(), now.getMonth() + 1));
        }
        
        // Recent records - fetch both steps and calories
        promises.push(getHealthData('steps', 5));
        promises.push(getHealthData('active_calories', 5));
        
        // Fetch all in parallel
        const [stepsStats, caloriesStats, stepsData, caloriesData] = await Promise.all(promises);
        
        setStepsStats(stepsStats);
        setCaloriesStats(caloriesStats);
        setRecentData(stepsData?.data || []);
      } else {
        // For sleep, fetch normally
        // Statistics promise
        if (selectedPeriod === 'daily') {
          promises.push(getDailyStatistics(selectedDataType, today));
        } else if (selectedPeriod === 'weekly') {
          const now = new Date();
          const currentDay = now.getDay();
          const isEarlyWeek = currentDay <= 2;
          const daysToSubtract = isEarlyWeek ? currentDay + 7 : currentDay;
          const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
          const year = weekStart.getFullYear();
          const month = String(weekStart.getMonth() + 1).padStart(2, '0');
          const day = String(weekStart.getDate()).padStart(2, '0');
          const startDateStr = `${year}-${month}-${day}`;
          promises.push(getWeeklyStatistics(selectedDataType, startDateStr));
        } else if (selectedPeriod === 'monthly') {
          const now = new Date();
          promises.push(getMonthlyStatistics(selectedDataType, now.getFullYear(), now.getMonth() + 1));
        }
        
        // Recent records promise
        promises.push(getHealthData(selectedDataType, 5));
        
        // Fetch both in parallel
        const [stats, data] = await Promise.all(promises);
        
        setStatistics(stats);
        setRecentData(data?.data || []);
      }
    } catch (error) {
      console.error('Error fetching synced data:', error);
      toast.error('Failed to load synced data');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const getDataTypeIcon = (type) => {
    switch (type) {
      case 'steps':
        return 'walk';
      case 'sleep':
        return 'sleep';
      default:
        return 'chart-line';
    }
  };

  const getDataTypeLabel = (type) => {
    switch (type) {
      case 'steps':
        return 'Steps';
      case 'sleep':
        return 'Sleep';
      default:
        return type;
    }
  };

  const formatValue = (value, type) => {
    if (!value && value !== 0) return 'N/A';
    
    switch (type) {
      case 'steps':
        return `${Math.round(value).toLocaleString()} steps`;
      case 'active_calories':
        return `${Math.round(value)} kcal`;
      case 'sleep':
        // Show hours if over 60 minutes, otherwise show minutes
        if (value >= 60) {
          const hours = (value / 60).toFixed(1);
          return `${hours} hrs`;
        }
        return `${Math.round(value)} min`;
      default:
        return value.toString();
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderStatisticsCard = () => {
    if (selectedDataType === 'steps') {
      // Show both steps and calories for steps
      if (!stepsStats || !caloriesStats) return null;

      return (
        <View style={[styles.statisticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statisticsTitle, { color: colors.text }]}>
            {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Summary
          </Text>

          {/* Steps Section */}
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <Icon name="walk" size={20} color="#4CAF50" />
              <Text style={[styles.activityTitle, { color: colors.text }]}>Steps</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Icon name="chart-line-variant" size={24} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatValue(stepsStats.average, 'steps')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.secondary }]}>Average</Text>
              </View>

              <View style={styles.statItem}>
                <Icon name="arrow-up-bold" size={24} color="#4CAF50" />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatValue(stepsStats.max, 'steps')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.secondary }]}>Max</Text>
              </View>

              <View style={styles.statItem}>
                <Icon name="sigma" size={24} color={colors.accent} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatValue(stepsStats.total, 'steps')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.secondary }]}>Total</Text>
              </View>
            </View>
          </View>

          {/* Calories Section */}
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <Icon name="fire" size={20} color="#FF5722" />
              <Text style={[styles.activityTitle, { color: colors.text }]}>Calories Burned</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Icon name="chart-line-variant" size={24} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatValue(caloriesStats.average, 'active_calories')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.secondary }]}>Average</Text>
              </View>

              <View style={styles.statItem}>
                <Icon name="arrow-up-bold" size={24} color="#FF5722" />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatValue(caloriesStats.max, 'active_calories')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.secondary }]}>Max</Text>
              </View>

              <View style={styles.statItem}>
                <Icon name="sigma" size={24} color={colors.accent} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatValue(caloriesStats.total, 'active_calories')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.secondary }]}>Total</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // For sleep, show normal statistics
    if (!statistics) return null;

    const stats = statistics || {};
    
    return (
      <View style={[styles.statisticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statisticsTitle, { color: colors.text }]}>
          {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Summary
        </Text>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Icon name="chart-line-variant" size={24} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatValue(stats.average, selectedDataType)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>Average</Text>
          </View>

          <View style={styles.statItem}>
            <Icon name="arrow-up-bold" size={24} color="#4CAF50" />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatValue(stats.max, selectedDataType)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>Maximum</Text>
          </View>

          <View style={styles.statItem}>
            <Icon name="arrow-down-bold" size={24} color="#2196F3" />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatValue(stats.min, selectedDataType)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.secondary }]}>Minimum</Text>
          </View>

          {selectedDataType !== 'sleep' && (
            <View style={styles.statItem}>
              <Icon name="sigma" size={24} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatValue(stats.total, selectedDataType)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.secondary }]}>Total</Text>
            </View>
          )}
        </View>

        <View style={styles.recordCountContainer}>
          <Icon name="database" size={16} color={colors.secondary} />
          <Text style={[styles.recordCount, { color: colors.secondary }]}>
            {stats.count || 0} records
          </Text>
        </View>
      </View>
    );
  };

  const renderRecentRecords = () => {
    if (recentData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="cloud-off-outline" size={64} color={colors.secondary} />
          <Text style={[styles.emptyText, { color: colors.secondary }]}>
            No synced data available
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.recentSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Records</Text>
        
        {recentData.map((record, index) => (
          <View
            key={record._id || index}
            style={[
              styles.recordItem,
              { borderBottomColor: colors.border },
              index === recentData.length - 1 && styles.lastRecordItem,
            ]}
          >
            <View style={styles.recordLeft}>
              <View style={[styles.recordIcon, { backgroundColor: colors.primary + '20' }]}>
                <Icon name={getDataTypeIcon(selectedDataType)} size={20} color={colors.primary} />
              </View>
              <View style={styles.recordInfo}>
                <Text style={[styles.recordValue, { color: colors.text }]}>
                  {formatValue(record.value, selectedDataType)}
                </Text>
                <Text style={[styles.recordTime, { color: colors.secondary }]}>
                  {formatTimestamp(record.timestamp)}
                </Text>
              </View>
            </View>
            
            {record.metadata?.source && (
              <Text style={[styles.recordSource, { color: colors.secondary }]}>
                {record.metadata.source}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    backButton: {
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: 4,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    dataTypeSelector: {
      flexDirection: 'row',
      marginBottom: 16,
      gap: 8,
    },
    dataTypeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    dataTypeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dataTypeButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
    },
    dataTypeButtonTextActive: {
      color: '#fff',
    },
    periodSelector: {
      flexDirection: 'row',
      marginBottom: 16,
      gap: 8,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
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
    statisticsCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
    },
    statisticsTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    activitySection: {
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    activityTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    statItem: {
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 8,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
    },
    recordCountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    recordCount: {
      fontSize: 14,
    },
    recentSection: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    recordItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    lastRecordItem: {
      borderBottomWidth: 0,
    },
    recordLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    recordIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    recordInfo: {
      flex: 1,
    },
    recordValue: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    recordTime: {
      fontSize: 12,
    },
    recordSource: {
      fontSize: 11,
      marginLeft: 8,
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
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 16,
      marginTop: 16,
      textAlign: 'center',
    },
  });

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Synced Health Data</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading synced data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Synced Health Data</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          View your cloud-synced health data and statistics
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
        {/* Data Type Selector */}
        <View style={styles.dataTypeSelector}>
          <TouchableOpacity
            style={[
              styles.dataTypeButton,
              selectedDataType === 'steps' && styles.dataTypeButtonActive,
            ]}
            onPress={() => setSelectedDataType('steps')}
          >
            <Icon
              name="walk"
              size={18}
              color={selectedDataType === 'steps' ? '#fff' : colors.text}
            />
            <Text
              style={[
                styles.dataTypeButtonText,
                selectedDataType === 'steps' && styles.dataTypeButtonTextActive,
              ]}
            >
              Steps
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dataTypeButton,
              selectedDataType === 'sleep' && styles.dataTypeButtonActive,
            ]}
            onPress={() => setSelectedDataType('sleep')}
          >
            <Icon
              name="sleep"
              size={18}
              color={selectedDataType === 'sleep' ? '#fff' : colors.text}
            />
            <Text
              style={[
                styles.dataTypeButtonText,
                selectedDataType === 'sleep' && styles.dataTypeButtonTextActive,
              ]}
            >
              Sleep
            </Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'daily' && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod('daily')}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === 'daily' && styles.periodButtonTextActive,
              ]}
            >
              Daily
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'weekly' && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod('weekly')}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === 'weekly' && styles.periodButtonTextActive,
              ]}
            >
              Weekly
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodButton,
              selectedPeriod === 'monthly' && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod('monthly')}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === 'monthly' && styles.periodButtonTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
        </View>

        {/* Statistics Card */}
        {renderStatisticsCard()}

        {/* Recent Records */}
        {renderRecentRecords()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SyncedHealthDataScreen;
