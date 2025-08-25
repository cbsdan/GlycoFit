import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();

  // Sample data for dashboard
  const todayStats = [
    {
      id: 'glucose',
      title: 'Blood Glucose',
      value: '120',
      unit: 'mg/dL',
      status: 'normal',
      icon: 'water',
      color: '#27AE60',
    },
    {
      id: 'steps',
      title: 'Steps Today',
      value: '8,432',
      unit: 'steps',
      status: 'good',
      icon: 'walk',
      color: '#3498DB',
    },
    {
      id: 'heart-rate',
      title: 'Heart Rate',
      value: '72',
      unit: 'bpm',
      status: 'normal',
      icon: 'heart-pulse',
      color: '#E74C3C',
    },
    {
      id: 'sleep',
      title: 'Sleep Last Night',
      value: '7.5',
      unit: 'hours',
      status: 'good',
      icon: 'sleep',
      color: '#9B59B6',
    },
  ];

  const quickActions = [
    {
      id: 'measure',
      title: 'Quick Measure',
      subtitle: 'Record glucose level',
      icon: 'plus-circle',
      color: '#27AE60',
      action: () => navigation.navigate('Measure'),
    },
    {
      id: 'food',
      title: 'Log Food',
      subtitle: 'Scan or add meal',
      icon: 'food',
      color: '#F39C12',
      action: () => navigation.navigate('Measure'),
    },
    {
      id: 'insights',
      title: 'View Insights',
      subtitle: 'Check predictions',
      icon: 'chart-line',
      color: '#3498DB',
      action: () => navigation.navigate('Prediction'),
    },
  ];

  const recentReadings = [
    {
      id: 1,
      type: 'Blood Glucose',
      value: '118 mg/dL',
      time: '2 hours ago',
      status: 'normal',
    },
    {
      id: 2,
      type: 'Blood Pressure',
      value: '120/80 mmHg',
      time: '1 day ago',
      status: 'normal',
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
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.welcomeText}>
            <Text style={styles.userName}>
              {user?.first_name?.split(' ')[0] || 'User'} {user?.last_name?.split(' ')[0] || ''}
            </Text>
          </Text>
        </View>

        {/* Today's Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Today's Overview</Text>
          <View style={styles.statsGrid}>
            {todayStats.map((stat) => (
              <TouchableOpacity
                key={stat.id}
                style={styles.statCard}
                onPress={() => toast.info(`${stat.title} details coming soon!`)}
                activeOpacity={0.7}
              >
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(stat.status) }]} />
                
                <View style={styles.statHeader}>
                  <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                    <Icon name={stat.icon} size={18} color={stat.color} />
                  </View>
                  <Text style={styles.statTitle}>{stat.title}</Text>
                </View>

                <Text style={styles.statValue}>
                  {stat.value}
                  <Text style={styles.statUnit}> {stat.unit}</Text>
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

        {/* Recent Readings */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Readings</Text>
          <View style={styles.recentList}>
            {recentReadings.map((reading) => (
              <TouchableOpacity
                key={reading.id}
                style={styles.recentCard}
                onPress={() => toast.info('Reading details coming soon!')}
                activeOpacity={0.7}
              >
                <View style={styles.recentContent}>
                  <Text style={styles.recentTitle}>{reading.type}</Text>
                  <Text style={styles.recentTime}>{reading.time}</Text>
                </View>
                <Text style={styles.recentValue}>{reading.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;
