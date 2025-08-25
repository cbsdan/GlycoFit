import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SettingsScreen = ({ navigation }) => {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const toast = useToast();
  const { user, logout } = useAuth();
  
  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [dataSync, setDataSync] = useState(true);
  const [reminders, setReminders] = useState(true);

  const settingSections = [
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          title: 'Profile Information',
          subtitle: 'Update your personal details',
          icon: 'account',
          action: () => handleSettingPress('Profile'),
          showArrow: true,
        },
        {
          id: 'privacy',
          title: 'Privacy & Security',
          subtitle: 'Manage your privacy settings',
          icon: 'shield-check',
          action: () => handleSettingPress('Privacy'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Health Data',
      items: [
        {
          id: 'data-export',
          title: 'Export Data',
          subtitle: 'Download your health records',
          icon: 'download',
          action: () => handleDataExport(),
          showArrow: true,
        },
        {
          id: 'data-sync',
          title: 'Cloud Sync',
          subtitle: 'Sync data across devices',
          icon: 'cloud-upload',
          hasSwitch: true,
          value: dataSync,
          onToggle: setDataSync,
        },
        {
          id: 'integrations',
          title: 'Health App Integration',
          subtitle: 'Connect with other health apps',
          icon: 'link',
          action: () => handleSettingPress('Integrations'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: 'push-notifications',
          title: 'Push Notifications',
          subtitle: 'Receive app notifications',
          icon: 'bell',
          hasSwitch: true,
          value: notifications,
          onToggle: setNotifications,
        },
        {
          id: 'reminders',
          title: 'Medication Reminders',
          subtitle: 'Get reminded to take medications',
          icon: 'alarm',
          hasSwitch: true,
          value: reminders,
          onToggle: setReminders,
        },
        {
          id: 'notification-settings',
          title: 'Notification Settings',
          subtitle: 'Customize notification preferences',
          icon: 'cog',
          action: () => handleSettingPress('Notifications'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          id: 'dark-mode',
          title: 'Dark Mode',
          subtitle: 'Switch between light and dark theme',
          icon: 'weather-night',
          hasSwitch: true,
          value: isDarkMode,
          onToggle: toggleTheme,
        },
        {
          id: 'units',
          title: 'Units',
          subtitle: 'Set preferred measurement units',
          icon: 'speedometer',
          action: () => handleSettingPress('Units'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          icon: 'help-circle',
          action: () => handleSettingPress('Help'),
          showArrow: true,
        },
        {
          id: 'about',
          title: 'About GlycoFit',
          subtitle: 'App version and information',
          icon: 'information',
          action: () => handleSettingPress('About'),
          showArrow: true,
        },
        {
          id: 'feedback',
          title: 'Send Feedback',
          subtitle: 'Share your thoughts with us',
          icon: 'message-text',
          action: () => handleSendFeedback(),
          showArrow: true,
        },
      ],
    },
  ];

  const handleSettingPress = (settingName) => {
    toast.info(`${settingName} settings coming soon!`);
  };

  const handleDataExport = () => {
    toast.info('Data export feature coming soon!');
  };

  const handleSendFeedback = () => {
    toast.info('Feedback form coming soon!');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              toast.success('Signed out successfully');
            } catch (error) {
              toast.error('Error signing out');
            }
          },
        },
      ]
    );
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
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.secondary,
      lineHeight: 22,
    },
    userCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    avatarText: {
      fontSize: 24,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: colors.secondary,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      marginLeft: 4,
    },
    settingItem: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    settingIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    settingSubtitle: {
      fontSize: 13,
      color: colors.secondary,
      lineHeight: 18,
    },
    settingAction: {
      marginLeft: 12,
    },
    logoutSection: {
      marginTop: 16,
      marginBottom: 32,
    },
    logoutButton: {
      backgroundColor: '#E74C3C',
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    version: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.secondary,
      marginTop: 16,
    },
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Manage your account, preferences, and app settings.
          </Text>
        </View>

        {/* User Profile Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(user?.first_name || user?.email)}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {user?.first_name || 'User'} {user?.last_name || ''}
            </Text>
            <Text style={styles.userEmail}>
              {user?.email || 'user@example.com'}
            </Text>
          </View>
        </View>

        {/* Settings Sections */}
        {settingSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            
            {section.items.map((item) => (
              <View key={item.id} style={styles.settingItem}>
                <TouchableOpacity
                  style={styles.settingButton}
                  onPress={item.action}
                  disabled={item.hasSwitch}
                  activeOpacity={item.hasSwitch ? 1 : 0.7}
                >
                  <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Icon name={item.icon} size={20} color={colors.primary} />
                  </View>
                  
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                  </View>
                  
                  <View style={styles.settingAction}>
                    {item.hasSwitch ? (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: colors.border, true: `${colors.primary}50` }}
                        thumbColor={item.value ? colors.primary : colors.secondary}
                      />
                    ) : item.showArrow ? (
                      <Icon name="chevron-right" size={20} color={colors.secondary} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Icon name="logout" size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>
          GlycoFit v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
