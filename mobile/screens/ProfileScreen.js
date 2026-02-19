import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ProfileScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();
  const { user, updateUserData } = useAuth();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile data
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    age: '',
    sex: '',
    height: '',
    weight: '',
    diagnosis_status: '',
    avatar: null,
  });

  const [avatarUri, setAvatarUri] = useState(null);
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  // Handle unit switching for height
  useEffect(() => {
    if (isEditing && profileData.height) {
      const cm = parseFloat(profileData.height);
      if (!cm || isNaN(cm)) return;

      if (heightUnit === 'ft') {
        // Convert to feet/inches
        const totalInches = cm / 2.54;
        const ft = Math.floor(totalInches / 12);
        const inch = Math.round(totalInches % 12);
        setFeet(ft.toString());
        setInches(inch.toString());
        setHeightInput(''); // Clear the single input when using ft/in
      } else {
        // Convert cm to selected unit
        if (heightUnit === 'cm') {
          setHeightInput(cm.toFixed(2));
        } else if (heightUnit === 'm') {
          setHeightInput((cm / 100).toFixed(2));
        } else if (heightUnit === 'in') {
          setHeightInput((cm / 2.54).toFixed(2));
        }
        setFeet('');
        setInches('');
      }
    }
  }, [heightUnit, isEditing]);

  // Handle unit switching for weight
  useEffect(() => {
    if (isEditing && profileData.weight) {
      const kg = parseFloat(profileData.weight);
      if (!kg || isNaN(kg)) return;

      if (weightUnit === 'kg') {
        setWeightInput(kg.toFixed(2));
      } else if (weightUnit === 'lbs') {
        setWeightInput((kg * 2.20462).toFixed(2));
      } else if (weightUnit === 'stone') {
        setWeightInput((kg / 6.35029).toFixed(2));
      }
    }
  }, [weightUnit, isEditing]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      // Note: api.getProfile() is automatically cached via CacheService
      // Cache is invalidated after profile updates
      const response = await api.getProfile();
      
      if (response.success) {
        const userData = response.user;
        setProfileData({
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          age: userData.age?.toString() || '',
          sex: userData.sex || '',
          height: userData.height?.toString() || '',
          weight: userData.weight?.toString() || '',
          diagnosis_status: userData.diagnosis_status || 'not_diagnosed',
          avatar: userData.avatar || null,
        });
        
        // Initialize input fields with stored values
        if (userData.height) {
          const cm = parseFloat(userData.height);
          setHeightInput(cm.toFixed(2));
        }
        if (userData.weight) {
          const kg = parseFloat(userData.weight);
          setWeightInput(kg.toFixed(2));
        }
        
        if (userData.avatar?.url) {
          setAvatarUri(userData.avatar.url);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Get display value for height based on current unit
  const getHeightDisplayValue = () => {
    if (!heightInput || heightInput === '') return '';
    const cm = parseFloat(heightInput);
    if (!cm || isNaN(cm)) return '';
    
    if (heightUnit === 'cm') {
      return cm.toFixed(2);
    } else if (heightUnit === 'm') {
      return (cm / 100).toFixed(2);
    } else if (heightUnit === 'in') {
      return (cm / 2.54).toFixed(2);
    }
    return '';
  };

  // Get display value for weight based on current unit
  const getWeightDisplayValue = () => {
    if (!weightInput || weightInput === '') return '';
    const kg = parseFloat(weightInput);
    if (!kg || isNaN(kg)) return '';
    
    if (weightUnit === 'kg') {
      return kg.toFixed(2);
    } else if (weightUnit === 'lbs') {
      return (kg * 2.20462).toFixed(2);
    } else if (weightUnit === 'stone') {
      return (kg / 6.35029).toFixed(2);
    }
    return '';
  };

  // Convert height to cm based on selected unit
  const convertHeightToCm = () => {
    if (heightUnit === 'cm') {
      return parseFloat(heightInput) || 0;
    } else if (heightUnit === 'ft') {
      const ft = parseFloat(feet) || 0;
      const inch = parseFloat(inches) || 0;
      return ((ft * 12) + inch) * 2.54;
    } else if (heightUnit === 'm') {
      return (parseFloat(heightInput) || 0) * 100;
    } else if (heightUnit === 'in') {
      return (parseFloat(heightInput) || 0) * 2.54;
    }
    return 0;
  };

  // Convert weight to kg based on selected unit
  const convertWeightToKg = () => {
    if (weightUnit === 'kg') {
      return parseFloat(weightInput) || 0;
    } else if (weightUnit === 'lbs') {
      return (parseFloat(weightInput) || 0) / 2.20462;
    } else if (weightUnit === 'stone') {
      return (parseFloat(weightInput) || 0) * 6.35029;
    }
    return 0;
  };

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant access to your photo library to change your avatar.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
        setProfileData({
          ...profileData,
          avatar: { uri: result.assets[0].uri },
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error('Failed to pick image');
    }
  };

  const handleSave = async () => {
    // Validation
    if (!profileData.first_name.trim() || !profileData.last_name.trim()) {
      toast.error('First name and last name are required');
      return;
    }

    if (profileData.age && (isNaN(profileData.age) || parseInt(profileData.age) < 0 || parseInt(profileData.age) > 150)) {
      toast.error('Please enter a valid age');
      return;
    }

    // Validate height based on unit
    if (heightUnit === 'ft') {
      const ft = parseFloat(feet);
      const inch = parseFloat(inches);
      if ((!ft && !inch) || ft < 0 || inch < 0 || inch >= 12) {
        toast.error('Please enter a valid height');
        return;
      }
    } else if (profileData.height && (isNaN(profileData.height) || parseFloat(profileData.height) <= 0)) {
      toast.error('Please enter a valid height');
      return;
    }

    // Validate weight
    if (profileData.weight && (isNaN(profileData.weight) || parseFloat(profileData.weight) <= 0)) {
      toast.error('Please enter a valid weight');
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        first_name: profileData.first_name.trim(),
        last_name: profileData.last_name.trim(),
      };

      // Add optional fields
      if (profileData.age) updateData.age = parseInt(profileData.age);
      if (profileData.sex) updateData.sex = profileData.sex;
      
      // Convert height to cm before saving
      const heightInCm = convertHeightToCm();
      if (heightInCm > 0) updateData.height = parseFloat(heightInCm.toFixed(2));
      
      // Convert weight to kg before saving
      const weightInKg = convertWeightToKg();
      if (weightInKg > 0) updateData.weight = parseFloat(weightInKg.toFixed(2));
      if (profileData.diagnosis_status !== undefined && profileData.diagnosis_status !== '') {
        updateData.diagnosis_status = profileData.diagnosis_status;
      }
      
      // Add avatar if changed
      if (profileData.avatar?.uri) {
        updateData.avatar = profileData.avatar;
      }

      const response = await api.updateProfile(updateData);

      if (response.success) {
        toast.success('Profile updated successfully');
        setIsEditing(false);
        
        // Update auth context
        if (updateUserData) {
          updateUserData(response.user);
        }
        
        // Reload profile to get updated data
        await loadProfile();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset inputs to stored values
    setHeightInput(profileData.height);
    setWeightInput(profileData.weight);
    setFeet('');
    setInches('');
    loadProfile(); // Reload original data
  };

  const calculateBMI = () => {
    const height = parseFloat(profileData.height);
    const weight = parseFloat(profileData.weight);
    
    if (height && weight && height > 0) {
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      return bmi.toFixed(1);
    }
    return null;
  };

  const getBMICategory = (bmi) => {
    if (!bmi) return '';
    const bmiValue = parseFloat(bmi);
    
    if (bmiValue < 18.5) return 'Underweight';
    if (bmiValue < 25) return 'Normal';
    if (bmiValue < 30) return 'Overweight';
    return 'Obese';
  };

  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}` || 'U';
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 12,
    },
    headerRight: {
      flexDirection: 'row',
      gap: 8,
    },
    headerButton: {
      padding: 8,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 12,
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: colors.card,
    },
    avatarImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    avatarText: {
      fontSize: 48,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    editAvatarButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    userName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: colors.secondary,
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
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: 12,
    },
    fieldContainer: {
      flex: 1,
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.secondary,
      marginBottom: 8,
    },
    fieldValue: {
      fontSize: 16,
      color: colors.text,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    pickerContainer: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    bmiContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: `${colors.primary}10`,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
    },
    bmiValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.primary,
    },
    bmiLabel: {
      fontSize: 14,
      color: colors.secondary,
      marginTop: 4,
    },
    bmiCategory: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    sexOptions: {
      flexDirection: 'row',
      gap: 8,
    },
    sexOption: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    sexOptionActive: {
      backgroundColor: `${colors.primary}15`,
      borderColor: colors.primary,
    },
    sexOptionText: {
      fontSize: 14,
      color: colors.secondary,
    },
    sexOptionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    diagnosisOptions: {
      gap: 8,
    },
    diagnosisOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      gap: 8,
    },
    diagnosisOptionActive: {
      backgroundColor: `${colors.primary}15`,
      borderColor: colors.primary,
    },
    diagnosisOptionText: {
      fontSize: 14,
      color: colors.secondary,
      flex: 1,
    },
    diagnosisOptionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    emptyValue: {
      fontSize: 16,
      color: colors.secondary,
      fontStyle: 'italic',
    },
    unitSelectorContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    unitButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unitButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    feetInchesContainer: {
      flexDirection: 'row',
      gap: 8,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <Icon name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const bmi = calculateBMI();
  const bmiCategory = getBMICategory(bmi);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        
        <View style={styles.headerRight}>
          {isEditing ? (
            <>
              <TouchableOpacity 
                onPress={handleCancel} 
                style={styles.headerButton}
                disabled={isSaving}
              >
                <Icon name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSave} 
                style={styles.headerButton}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon name="check" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              onPress={() => {
                setIsEditing(true);
              }} 
              style={styles.headerButton}
            >
              <Icon name="pencil" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {getInitials(profileData.first_name, profileData.last_name)}
                </Text>
              )}
            </View>
            {isEditing && (
              <TouchableOpacity 
                style={styles.editAvatarButton} 
                onPress={handlePickImage}
                disabled={isSaving}
              >
                <Icon name="camera" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          
          {!isEditing && (
            <>
              <Text style={styles.userName}>
                {profileData.first_name} {profileData.last_name}
              </Text>
              <Text style={styles.userEmail}>{profileData.email}</Text>
            </>
          )}
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.card}>
            {isEditing ? (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>First Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={profileData.first_name}
                      onChangeText={(text) => setProfileData({ ...profileData, first_name: text })}
                      placeholder="Enter first name"
                      placeholderTextColor={colors.secondary}
                      editable={!isSaving}
                    />
                  </View>
                  
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Last Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={profileData.last_name}
                      onChangeText={(text) => setProfileData({ ...profileData, last_name: text })}
                      placeholder="Enter last name"
                      placeholderTextColor={colors.secondary}
                      editable={!isSaving}
                    />
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={[styles.input, { color: colors.secondary }]}
                    value={profileData.email}
                    editable={false}
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Age</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.age}
                    onChangeText={(text) => setProfileData({ ...profileData, age: text })}
                    placeholder="Enter your age"
                    placeholderTextColor={colors.secondary}
                    keyboardType="numeric"
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Sex</Text>
                  <View style={styles.sexOptions}>
                    <TouchableOpacity
                      style={[
                        styles.sexOption,
                        profileData.sex === 'male' && styles.sexOptionActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, sex: 'male' })}
                      disabled={isSaving}
                    >
                      <Icon 
                        name="gender-male" 
                        size={20} 
                        color={profileData.sex === 'male' ? colors.primary : colors.secondary} 
                      />
                      <Text style={[
                        styles.sexOptionText,
                        profileData.sex === 'male' && styles.sexOptionTextActive,
                      ]}>
                        Male
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.sexOption,
                        profileData.sex === 'female' && styles.sexOptionActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, sex: 'female' })}
                      disabled={isSaving}
                    >
                      <Icon 
                        name="gender-female" 
                        size={20} 
                        color={profileData.sex === 'female' ? colors.primary : colors.secondary} 
                      />
                      <Text style={[
                        styles.sexOptionText,
                        profileData.sex === 'female' && styles.sexOptionTextActive,
                      ]}>
                        Female
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.sexOption,
                        profileData.sex === 'other' && styles.sexOptionActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, sex: 'other' })}
                      disabled={isSaving}
                    >
                      <Icon 
                        name="gender-male-female" 
                        size={20} 
                        color={profileData.sex === 'other' ? colors.primary : colors.secondary} 
                      />
                      <Text style={[
                        styles.sexOptionText,
                        profileData.sex === 'other' && styles.sexOptionTextActive,
                      ]}>
                        Other
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Diagnosis Status (Prediabetes and Type 2 Diabetes Only)</Text>
                  <View style={styles.diagnosisOptions}>
                    <TouchableOpacity
                      style={[
                        styles.diagnosisOption,
                        profileData.diagnosis_status === 'not_diagnosed' && styles.diagnosisOptionActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, diagnosis_status: 'not_diagnosed' })}
                      disabled={isSaving}
                    >
                      <Icon 
                        name="check-circle-outline" 
                        size={20} 
                        color={profileData.diagnosis_status === 'not_diagnosed' ? colors.primary : colors.secondary} 
                      />
                      <Text style={[
                        styles.diagnosisOptionText,
                        profileData.diagnosis_status === 'not_diagnosed' && styles.diagnosisOptionTextActive,
                      ]}>
                        Not Diagnosed with Prediabetes or Type 2 Diabetes 
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.diagnosisOption,
                        profileData.diagnosis_status === 'prediabetes' && styles.diagnosisOptionActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, diagnosis_status: 'prediabetes' })}
                      disabled={isSaving}
                    >
                      <Icon 
                        name="alert-circle-outline" 
                        size={20} 
                        color={profileData.diagnosis_status === 'prediabetes' ? colors.primary : colors.secondary} 
                      />
                      <Text style={[
                        styles.diagnosisOptionText,
                        profileData.diagnosis_status === 'prediabetes' && styles.diagnosisOptionTextActive,
                      ]}>
                        Prediabetes
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.diagnosisOption,
                        profileData.diagnosis_status === 'type2_diabetes' && styles.diagnosisOptionActive,
                      ]}
                      onPress={() => setProfileData({ ...profileData, diagnosis_status: 'type2_diabetes' })}
                      disabled={isSaving}
                    >
                      <Icon 
                        name="medical-bag" 
                        size={20} 
                        color={profileData.diagnosis_status === 'type2_diabetes' ? colors.primary : colors.secondary} 
                      />
                      <Text style={[
                        styles.diagnosisOptionText,
                        profileData.diagnosis_status === 'type2_diabetes' && styles.diagnosisOptionTextActive,
                      ]}>
                        Type 2 Diabetes
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>First Name</Text>
                    <Text style={styles.fieldValue}>{profileData.first_name || '-'}</Text>
                  </View>
                  
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Last Name</Text>
                    <Text style={styles.fieldValue}>{profileData.last_name || '-'}</Text>
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <Text style={styles.fieldValue}>{profileData.email || '-'}</Text>
                </View>

                <View style={styles.fieldRow}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Age</Text>
                    <Text style={styles.fieldValue}>{profileData.age || '-'}</Text>
                  </View>
                  
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Sex</Text>
                    <Text style={styles.fieldValue}>
                      {profileData.sex ? profileData.sex.charAt(0).toUpperCase() + profileData.sex.slice(1) : '-'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Health Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Metrics</Text>
          <View style={styles.card}>
            {isEditing ? (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Height</Text>
                  
                  {/* Height Unit Selector */}
                  <View style={styles.unitSelectorContainer}>
                    <TouchableOpacity
                      style={[styles.unitButton, { backgroundColor: heightUnit === 'cm' ? colors.primary : colors.surface, borderColor: heightUnit === 'cm' ? colors.primary : colors.border }]}
                      onPress={() => setHeightUnit('cm')}
                      disabled={isSaving}
                    >
                      <Text style={[styles.unitButtonText, { color: heightUnit === 'cm' ? '#FFFFFF' : colors.text }]}>cm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, { backgroundColor: heightUnit === 'ft' ? colors.primary : colors.surface, borderColor: heightUnit === 'ft' ? colors.primary : colors.border }]}
                      onPress={() => setHeightUnit('ft')}
                      disabled={isSaving}
                    >
                      <Text style={[styles.unitButtonText, { color: heightUnit === 'ft' ? '#FFFFFF' : colors.text }]}>ft/in</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, { backgroundColor: heightUnit === 'm' ? colors.primary : colors.surface, borderColor: heightUnit === 'm' ? colors.primary : colors.border }]}
                      onPress={() => setHeightUnit('m')}
                      disabled={isSaving}
                    >
                      <Text style={[styles.unitButtonText, { color: heightUnit === 'm' ? '#FFFFFF' : colors.text }]}>m</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, { backgroundColor: heightUnit === 'in' ? colors.primary : colors.surface, borderColor: heightUnit === 'in' ? colors.primary : colors.border }]}
                      onPress={() => setHeightUnit('in')}
                      disabled={isSaving}
                    >
                      <Text style={[styles.unitButtonText, { color: heightUnit === 'in' ? '#FFFFFF' : colors.text }]}>in</Text>
                    </TouchableOpacity>
                  </View>

                  {heightUnit === 'ft' ? (
                    <View style={styles.feetInchesContainer}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={feet}
                        onChangeText={(text) => setFeet(text)}
                        placeholder="Feet"
                        placeholderTextColor={colors.secondary}
                        keyboardType="numeric"
                        editable={!isSaving}
                      />
                      <TextInput
                        style={[styles.input, { flex: 1, marginLeft: 8 }]}
                        value={inches}
                        onChangeText={(text) => setInches(text)}
                        placeholder="Inches"
                        placeholderTextColor={colors.secondary}
                        keyboardType="numeric"
                        editable={!isSaving}
                      />
                    </View>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={heightInput}
                      onChangeText={(text) => setHeightInput(text)}
                      placeholder={`Enter height in ${heightUnit}`}
                      placeholderTextColor={colors.secondary}
                      keyboardType="decimal-pad"
                      editable={!isSaving}
                    />
                  )}
                </View>
                
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Weight</Text>
                  
                  {/* Weight Unit Selector */}
                  <View style={styles.unitSelectorContainer}>
                    <TouchableOpacity
                      style={[styles.unitButton, { backgroundColor: weightUnit === 'kg' ? colors.primary : colors.surface, borderColor: weightUnit === 'kg' ? colors.primary : colors.border }]}
                      onPress={() => setWeightUnit('kg')}
                      disabled={isSaving}
                    >
                      <Text style={[styles.unitButtonText, { color: weightUnit === 'kg' ? '#FFFFFF' : colors.text }]}>kg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, { backgroundColor: weightUnit === 'lbs' ? colors.primary : colors.surface, borderColor: weightUnit === 'lbs' ? colors.primary : colors.border }]}
                      onPress={() => setWeightUnit('lbs')}
                      disabled={isSaving}
                    >
                      <Text style={[styles.unitButtonText, { color: weightUnit === 'lbs' ? '#FFFFFF' : colors.text }]}>lbs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, { backgroundColor: weightUnit === 'stone' ? colors.primary : colors.surface, borderColor: weightUnit === 'stone' ? colors.primary : colors.border }]}
                      onPress={() => setWeightUnit('stone')}
                      disabled={isSaving}
                    >
                      <Text style={[styles.unitButtonText, { color: weightUnit === 'stone' ? '#FFFFFF' : colors.text }]}>stone</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.input}
                    value={weightInput}
                    onChangeText={(text) => setWeightInput(text)}
                    placeholder={`Enter weight in ${weightUnit}`}
                    placeholderTextColor={colors.secondary}
                    keyboardType="decimal-pad"
                    editable={!isSaving}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Height</Text>
                    <Text style={styles.fieldValue}>
                      {profileData.height ? `${parseFloat(profileData.height).toFixed(2)} cm` : '-'}
                    </Text>
                  </View>
                  
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Weight</Text>
                    <Text style={styles.fieldValue}>
                      {profileData.weight ? `${parseFloat(profileData.weight).toFixed(2)} kg` : '-'}
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Diagnosis Status</Text>
                  <Text style={styles.fieldValue}>
                    {profileData.diagnosis_status === 'not_diagnosed' && 'Not Diagnosed'}
                    {profileData.diagnosis_status === 'prediabetes' && 'Prediabetes'}
                    {profileData.diagnosis_status === 'type2_diabetes' && 'Type 2 Diabetes'}
                    {!profileData.diagnosis_status && '-'}
                  </Text>
                </View>
              </>
            )}

            {bmi && (
              <View style={styles.bmiContainer}>
                <View>
                  <Text style={styles.bmiValue}>{bmi}</Text>
                  <Text style={styles.bmiLabel}>BMI</Text>
                </View>
                <Text style={styles.bmiCategory}>{bmiCategory}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
