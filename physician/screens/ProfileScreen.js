import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { physicianAPI } from '../services/api';
import EditProfileScreen from './EditProfileScreen';

export default function ProfileScreen() {
  const { colors: theme, isDarkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [physicianProfile, setPhysicianProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profileRes, statsRes] = await Promise.all([
        physicianAPI.getProfile(),
        physicianAPI.getStats(),
      ]);

      if (profileRes.success) {
        setPhysicianProfile(profileRes.data.physician_info);
      }

      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 16 }}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleCloseEditModal = (updated = false) => {
    setShowEditModal(false);
    if (updated) {
      fetchProfile();
    }
  };

  const handleProfilePictureUpload = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload a profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLoading(true);
        try {
          const response = await physicianAPI.uploadProfilePicture(result.assets[0].uri);
          if (response.success) {
            toast.success('Profile picture updated successfully');
            await fetchProfile();
          } else {
            toast.error(response.message || 'Failed to upload profile picture');
          }
        } catch (error) {
          console.error('Upload error:', error);
          toast.error('Failed to upload profile picture');
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      toast.error('Failed to select image');
    }
  };

  const profileSections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', action: handleEditProfile },
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
          {user?.avatar?.url ? (
            <Image
              source={{ uri: user.avatar.url }}
              style={styles.profileImage}
            />
          ) : (
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
          )}
          <TouchableOpacity
            style={[
              styles.editImageButton,
              { backgroundColor: theme.primary },
            ]}
            onPress={handleProfilePictureUpload}
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
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats?.total_patients || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.secondary }]}>
              Patients
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats?.total_consultations || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.secondary }]}>
              Consultations
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {physicianProfile?.rating?.toFixed(1) || '0.0'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.secondary }]}>
              Rating
            </Text>
          </View>
        </View>
      </View>

      {/* Professional Info */}
      {!physicianProfile?.specialization || !physicianProfile?.license_number ? (
        <View
          style={[
            styles.setupCard,
            {
              backgroundColor: theme.primary + '20',
              borderColor: theme.primary,
            },
          ]}
        >
          <Ionicons name="alert-circle" size={32} color={theme.primary} />
          <Text style={[styles.setupTitle, { color: theme.text }]}>
            Complete Your Profile
          </Text>
          <Text style={[styles.setupMessage, { color: theme.secondary }]}>
            Please complete your professional information to start accepting patients
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: theme.primary }]}
            onPress={handleEditProfile}
          >
            <Text style={styles.setupButtonText}>Set Up Profile</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
              {physicianProfile?.specialization || 'Not set'}
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
              {physicianProfile?.license_number || 'Not set'}
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
              {physicianProfile?.years_of_experience || 0} years
            </Text>
          </View>
        </View>
        {physicianProfile?.languages && physicianProfile.languages.length > 0 && (
          <View style={styles.infoItem}>
            <Ionicons name="language" size={20} color={theme.secondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.secondary }]}>
                Languages
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {physicianProfile.languages.join(', ')}
              </Text>
            </View>
          </View>
        )}
        {physicianProfile?.bio && (
          <View style={styles.infoItem}>
            <Ionicons name="document-text" size={20} color={theme.secondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.secondary }]}>
                Bio
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {physicianProfile.bio}
              </Text>
            </View>
          </View>
        )}
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => handleCloseEditModal(false)}
      >
        <EditProfileScreen
          physicianProfile={physicianProfile}
          onClose={handleCloseEditModal}
        />
      </Modal>
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
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  setupCard: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  setupMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  setupButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
