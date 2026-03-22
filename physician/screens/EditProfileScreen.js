import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { physicianAPI } from '../services/api';

export default function EditProfileScreen({ physicianProfile, onClose }) {
  const { colors: theme } = useTheme();
  const { user, updateUserData } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    specialization: physicianProfile?.specialization || 'General Practice',
    license_number: physicianProfile?.license_number || '',
    years_of_experience: physicianProfile?.years_of_experience?.toString() || '0',
    bio: physicianProfile?.bio || '',
    consultation_fee: physicianProfile?.consultation_fee?.toString() || '0',
    languages: physicianProfile?.languages?.join(', ') || '',
  });

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);

      // Update user first/last name
      const userRes = await physicianAPI.updateUserProfile({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
      });

      // Update physician-specific info
      const physicianData = {
        specialization: formData.specialization,
        license_number: formData.license_number,
        years_of_experience: parseInt(formData.years_of_experience) || 0,
        bio: formData.bio,
        consultation_fee: parseFloat(formData.consultation_fee) || 0,
        languages: formData.languages.split(',').map(l => l.trim()).filter(l => l),
      };

      console.log('Sending update data:', physicianData);
      const physicianRes = await physicianAPI.updateProfile(physicianData);
      console.log('Update response:', physicianRes);

      if (physicianRes.success) {
        // Refresh cached user data with updated name
        const updatedUser = {
          ...user,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
        };
        updateUserData(updatedUser);

        toast.success('Profile updated successfully');
        onClose(true); // Pass true to indicate update was successful
      } else {
        toast.error(physicianRes.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.card,
              borderBottomColor: theme.border,
              ...theme.shadow,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => onClose(false)}
            style={styles.backButton}
          >
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Edit Profile
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={[styles.container, { backgroundColor: theme.background }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Personal Information
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                First Name
              </Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.first_name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, first_name: text })
                  }
                  placeholder="Enter first name"
                  placeholderTextColor={theme.secondary}
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                Last Name
              </Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.last_name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, last_name: text })
                  }
                  placeholder="Enter last name"
                  placeholderTextColor={theme.secondary}
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>
          </View>

          {/* Professional Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Professional Information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                Specialization
              </Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.specialization}
                  onChangeText={(text) =>
                    setFormData({ ...formData, specialization: text })
                  }
                  placeholder="e.g., Endocrinology, Diabetes Care"
                  placeholderTextColor={theme.secondary}
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                License Number
              </Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.license_number}
                  onChangeText={(text) =>
                    setFormData({ ...formData, license_number: text })
                  }
                  placeholder="e.g., MD-12345-2020"
                  placeholderTextColor={theme.secondary}
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                Years of Experience
              </Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.years_of_experience}
                  onChangeText={(text) =>
                    setFormData({ ...formData, years_of_experience: text })
                  }
                  placeholder="0"
                  placeholderTextColor={theme.secondary}
                  keyboardType="numeric"
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                Consultation Fee (₱)
              </Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.consultation_fee}
                  onChangeText={(text) =>
                    setFormData({ ...formData, consultation_fee: text })
                  }
                  placeholder="0.00"
                  placeholderTextColor={theme.secondary}
                  keyboardType="decimal-pad"
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                Languages (comma separated)
              </Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.languages}
                  onChangeText={(text) =>
                    setFormData({ ...formData, languages: text })
                  }
                  placeholder="e.g., English, Filipino, Spanish"
                  placeholderTextColor={theme.secondary}
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.secondary }]}>
                Bio
              </Text>
              <View
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={formData.bio}
                  onChangeText={(text) =>
                    setFormData({ ...formData, bio: text })
                  }
                  placeholder="Tell patients about yourself..."
                  placeholderTextColor={theme.secondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{ color: theme.text, flex: 1 }}
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: theme.primary,
                  opacity: loading ? 0.7 : 1,
                },
              ]}
              onPress={handleUpdateProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
