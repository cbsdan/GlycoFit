import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProfileScreen() {
  const { colors: theme, isDarkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  const profileSections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', action: () => {} },
        { icon: 'lock-closed-outline', label: 'Change Password', action: () => {} },
        { icon: 'notifications-outline', label: 'Notifications', action: () => {} },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: 'moon-outline', label: 'Dark Mode', action: toggleTheme, toggle: true },
        { icon: 'language-outline', label: 'Language', action: () => {} },
        { icon: 'shield-checkmark-outline', label: 'Privacy', action: () => {} },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help & Support', action: () => {} },
        { icon: 'document-text-outline', label: 'Terms & Conditions', action: () => {} },
        { icon: 'information-circle-outline', label: 'About', action: () => {} },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Profile Header */}
        <View
        style={[
          styles.profileHeader,
          {
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
            ...theme.shadow,
          },
        ]}
      >
        <View style={styles.profileImageContainer}>
          <View
            style={[
              styles.profileImagePlaceholder,
              { backgroundColor: theme.primary },
            ]}
          >
            <Text style={styles.profileInitials}>
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.editImageButton,
              { backgroundColor: theme.primary },
            ]}
          >
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.profileName, { color: theme.text }]}>
          Dr. {user?.first_name} {user?.last_name}
        </Text>
        <Text style={[styles.profileEmail, { color: theme.secondary }]}>
          {user?.email}
        </Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>24</Text>
            <Text style={[styles.statLabel, { color: theme.secondary }]}>
              Patients
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>156</Text>
            <Text style={[styles.statLabel, { color: theme.secondary }]}>
              Consultations
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>4.8</Text>
            <Text style={[styles.statLabel, { color: theme.secondary }]}>
              Rating
            </Text>
          </View>
        </View>
      </View>

      {/* Professional Info */}
      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            ...theme.shadow,
          },
        ]}
      >
        <Text style={[styles.infoTitle, { color: theme.text }]}>
          Professional Information
        </Text>
        <View style={styles.infoItem}>
          <Ionicons name="medical" size={20} color={theme.secondary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.secondary }]}>
              Specialization
            </Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              Endocrinology • Diabetes Care
            </Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="school" size={20} color={theme.secondary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.secondary }]}>
              License Number
            </Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              MD-12345-2020
            </Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="briefcase" size={20} color={theme.secondary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.secondary }]}>
              Experience
            </Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              12 years
            </Text>
          </View>
        </View>
      </View>

      {/* Settings Sections */}
      {profileSections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {section.title}
          </Text>
          <View
            style={[
              styles.settingsCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                ...theme.shadow,
              },
            ]}
          >
            {section.items.map((item, itemIndex) => (
              <View key={itemIndex}>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={item.action}
                  disabled={item.toggle}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={theme.secondary}
                    />
                    <Text style={[styles.settingLabel, { color: theme.text }]}>
                      {item.label}
                    </Text>
                  </View>
                  {item.toggle ? (
                    <Switch
                      value={isDarkMode}
                      onValueChange={toggleTheme}
                      trackColor={{
                        false: theme.border,
                        true: theme.primary,
                      }}
                      thumbColor="#FFFFFF"
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.secondary}
                    />
                  )}
                </TouchableOpacity>
                {itemIndex < section.items.length - 1 && (
                  <View
                    style={[
                      styles.settingDivider,
                      { backgroundColor: theme.border },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: theme.error + '20',
              borderColor: theme.error,
            },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color={theme.error} />
          <Text style={[styles.logoutText, { color: theme.error }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <Text style={[styles.versionText, { color: theme.secondary }]}>
        Version 1.0.0
      </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    marginLeft: 12,
  },
  settingDivider: {
    height: 1,
    marginLeft: 50,
  },
  logoutSection: {
    padding: 16,
    marginTop: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginVertical: 20,
  },
});
