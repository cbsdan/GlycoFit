import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';

const MeasureScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  // Food scanner state
  const [showFoodScanner, setShowFoodScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showFoodTypeModal, setShowFoodTypeModal] = useState(false);
  const [editableNutrients, setEditableNutrients] = useState({});
  const [focusedNutrient, setFocusedNutrient] = useState(null);
  
  // Meal details state
  const [mealDetails, setMealDetails] = useState({
    mealName: '',
    foodType: 'unlabeled',
    notes: '',
    nutrients: null
  });

  // Valid food types from backend model
  const foodTypes = [
    { label: 'Unlabeled', value: 'unlabeled' },
    { label: 'Breakfast', value: 'breakfast' },
    { label: 'Lunch', value: 'lunch' },
    { label: 'Dinner', value: 'dinner' },
    { label: 'Snacks', value: 'snacks' },
    { label: 'Drinks', value: 'drinks' },
    { label: 'Dessert', value: 'dessert' },
    { label: 'Other', value: 'other' },
  ];

  // Function to get nutrient icon and color
  const getNutrientIcon = (nutrientKey) => {
    const nutrientMap = {
      // Energy and Calories
      'calories': { icon: 'fire', color: '#E74C3C' },
      'energy': { icon: 'fire', color: '#E74C3C' },
      'kcal': { icon: 'fire', color: '#E74C3C' },
      
      // Macronutrients
      'protein': { icon: 'dumbbell', color: '#E67E22' },
      'carbohydrates': { icon: 'grain', color: '#F39C12' },
      'carbs': { icon: 'grain', color: '#F39C12' },
      'fat': { icon: 'water-outline', color: '#9B59B6' },
      'total_fat': { icon: 'water-outline', color: '#9B59B6' },
      'saturated_fat': { icon: 'water-alert', color: '#8E44AD' },
      'fiber': { icon: 'leaf', color: '#27AE60' },
      'sugar': { icon: 'cube-outline', color: '#E91E63' },
      
      // Minerals
      'sodium': { icon: 'shaker-outline', color: '#95A5A6' },
      'calcium': { icon: 'bone', color: '#ECF0F1' },
      'iron': { icon: 'anvil', color: '#34495E' },
      'potassium': { icon: 'lightning-bolt', color: '#F1C40F' },
      'magnesium': { icon: 'magnet', color: '#7F8C8D' },
      'zinc': { icon: 'chemical-weapon', color: '#BDC3C7' },
      
      // Vitamins
      'vitamin_a': { icon: 'eye', color: '#FF6B35' },
      'vitamin_c': { icon: 'citrus-slice', color: '#FFA500' },
      'vitamin_d': { icon: 'white-balance-sunny', color: '#FFD700' },
      'vitamin_e': { icon: 'alpha-e', color: '#90EE90' },
      'vitamin_k': { icon: 'alpha-k', color: '#006400' },
      'thiamin': { icon: 'alpha-b', color: '#4169E1' },
      'riboflavin': { icon: 'alpha-b', color: '#4169E1' },
      'niacin': { icon: 'alpha-b', color: '#4169E1' },
      'folate': { icon: 'alpha-b', color: '#4169E1' },
      'vitamin_b12': { icon: 'alpha-b', color: '#4169E1' },
      
      // Default for unknown nutrients
      'default': { icon: 'nutrition', color: '#3498DB' }
    };

    const key = nutrientKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return nutrientMap[key] || nutrientMap['default'];
  };

  const measurementOptions = [
    {
      id: 'heart-rate',
      title: 'Heart Rate',
      subtitle: 'Monitor your heart rate',
      icon: 'heart-pulse',
      color: '#E74C3C',
      action: () => handleMeasurement('Heart Rate'),
    },
    {
      id: 'sleep-track',
      title: 'Sleep Tracker',
      subtitle: 'Track your sleep patterns',
      icon: 'sleep',
      color: '#3498DB',
      action: () => handleMeasurement('Sleep Tracker'),
    },
    {
      id: 'food-scanner',
      title: 'Food Scanner',
      subtitle: 'Scan and log your meals',
      icon: 'camera',
      color: '#27AE60',
      action: () => openFoodScanner(),
    },
    {
      id: 'alcohol-intake',
      title: 'Alcohol Intake',
      subtitle: 'Track alcohol consumption',
      icon: 'glass-wine',
      color: '#8E44AD',
      action: () => handleMeasurement('Alcohol Intake'),
    },
    {
      id: 'smoke-intake',
      title: 'Smoke Intake',
      subtitle: 'Monitor smoking habits',
      icon: 'smoking',
      color: '#95A5A6',
      action: () => handleMeasurement('Smoke Intake'),
    },
    {
      id: 'step-counter',
      title: 'Step Counter',
      subtitle: 'Track daily steps and activity',
      icon: 'walk',
      color: '#F39C12',
      action: () => handleMeasurement('Step Counter'),
    },
  ];

  // Food Scanner Functions
  const openFoodScanner = () => {
    setShowFoodScanner(true);
    resetFoodScannerState();
  };

  const closeFoodScanner = () => {
    Alert.alert(
      'Close Food Scanner',
      'Are you sure you want to close? Any unsaved data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () => {
            setShowFoodScanner(false);
            resetFoodScannerState();
          }
        }
      ]
    );
  };

  const resetFoodScannerState = () => {
    setCapturedImage(null);
    setPredictionData(null);
    setEditableNutrients({});
    setFocusedNutrient(null);
    setMealDetails({
      mealName: '',
      foodType: 'unlabeled',
      notes: '',
      nutrients: null
    });
    setIsProcessing(false);
    setProcessingMessage('');
  };

  // Request camera permissions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to scan food. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library permission is required to select images. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Handle image capture from camera
  const handleCameraCapture = async () => {
    setShowImagePickerModal(false);
    
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      toast.error('Failed to capture image. Please try again.');
    }
  };

  // Handle image selection from library
  const handleLibrarySelection = async () => {
    setShowImagePickerModal(false);
    
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      toast.error('Failed to select image. Please try again.');
    }
  };

  // Process image and get nutrient prediction
  const processImage = async (imageUri) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing food image...');
    
    try {
      console.log('Starting image processing...');
      const response = await api.predictNutrientsOnly(imageUri);
      console.log('API response:', response);
      
      if (response && response.success && response.data) {
        console.log('Setting prediction data:', response.data);
        setPredictionData(response.data);
        setEditableNutrients(response.data.nutrients || {});
        setMealDetails(prev => ({
          ...prev,
          nutrients: response.data.nutrients
        }));
        
        toast.success('Food analysis complete! Review and edit the details below.');
      } else {
        console.log('API response failed:', response);
        toast.error(response?.error || 'Failed to analyze food image');
        setCapturedImage(null);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to analyze food. Please check your connection and try again.');
      setCapturedImage(null);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Save meal to database
  const saveMeal = async () => {
    setIsProcessing(true);
    setProcessingMessage('Saving your meal...');
    
    try {
      const response = await api.saveMeal(
        editableNutrients,
        mealDetails.mealName.trim(),
        mealDetails.foodType,
        mealDetails.notes.trim(),
        predictionData.temp_image_public_id
      );

      if (response.success) {
        toast.success('Meal saved successfully!');
        setShowFoodScanner(false);
        resetFoodScannerState();
      } else {
        toast.error(response.error || 'Failed to save meal');
      }
    } catch (error) {
      console.error('Error saving meal:', error);
      toast.error('Failed to save meal. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleMeasurement = (measurementType) => {
    toast.info(`${measurementType} feature coming soon!`);
    // TODO: Navigate to specific measurement screen
    // navigation.navigate(`${measurementType}Screen`);
  };

  // Handle nutrient value changes
  const handleNutrientChange = (nutrientKey, value) => {
    setEditableNutrients(prev => ({
      ...prev,
      [nutrientKey]: value
    }));
  };

  const getIconBackgroundStyle = (color) => ({
    backgroundColor: `${color}15`
  });

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
    measurementGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    measurementCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    },
    measurementIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    measurementTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    measurementSubtitle: {
      fontSize: 12,
      color: colors.secondary,
      lineHeight: 16,
    },
    recentSection: {
      marginTop: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    recentCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    recentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    recentTime: {
      fontSize: 12,
      color: colors.secondary,
    },
    recentValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    recentUnit: {
      fontSize: 14,
      color: colors.secondary,
      marginLeft: 4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      marginTop: 16,
    },
    
    // Food Scanner Modal Styles
    foodScannerModal: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scannerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      padding: 8,
    },
    headerSpacer: {
      width: 40,
    },
    scannerContent: {
      flex: 1,
      padding: 16,
    },
    
    // Image capture section
    captureSection: {
      marginBottom: 24,
    },
    captureButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    captureButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
      marginLeft: 12,
    },
    
    // Captured image display
    imageSection: {
      marginBottom: 24,
    },
    imageContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.border,
    },
    foodImage: {
      width: '100%',
      height: 200,
    },
    imageActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    retakeButton: {
      backgroundColor: colors.secondary,
      borderRadius: 8,
      padding: 12,
      flex: 1,
      marginRight: 8,
      alignItems: 'center',
    },
    retakeButtonText: {
      color: 'white',
      fontWeight: '600',
    },
    
    // Loading section
    loadingSection: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
    },
    
    // Prediction results section
    predictionSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nutrientSubtitle: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 16,
      fontStyle: 'italic',
    },
    nutrientsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 20,
    },
    nutrientCard: {
      width: '48%',
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      marginRight: '2%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    nutrientHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    nutrientIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    nutrientLabel: {
      fontSize: 12,
      color: colors.secondary,
      flex: 1,
      textTransform: 'capitalize',
    },
    nutrientValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    nutrientInput: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 4,
      padding: 4,
      backgroundColor: 'transparent',
      textAlign: 'left',
    },
    nutrientInputFocused: {
      borderColor: colors.primary,
      backgroundColor: colors.background,
    },
    
    // Meal details form
    formSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    notesInput: {
      height: 80,
      textAlignVertical: 'top',
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    picker: {
      height: 50,
    },
    dropdownButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: colors.background,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dropdownText: {
      fontSize: 16,
      color: colors.text,
    },
    
    // Action buttons
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cancelButton: {
      backgroundColor: colors.secondary,
      borderRadius: 8,
      padding: 16,
      flex: 1,
      marginRight: 8,
      alignItems: 'center',
    },
    saveButton: {
      backgroundColor: '#27AE60',
      borderRadius: 8,
      padding: 16,
      flex: 1,
      marginLeft: 8,
      alignItems: 'center',
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    
    // Image picker modal styles
    imagePickerModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    imagePickerModalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
    },
    imagePickerModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    modalButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    modalButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 12,
    },
    modalCancelButton: {
      backgroundColor: colors.secondary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    modalCancelText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Health Measurements</Text>
          <Text style={styles.subtitle}>
            Track your vital signs and health metrics to get better insights into your well-being.
          </Text>
        </View>

        <View style={styles.measurementGrid}>
          {measurementOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.measurementCard}
              onPress={option.action}
              activeOpacity={0.7}
            >
              <View style={[styles.measurementIcon, getIconBackgroundStyle(option.color)]}>
                <Icon name={option.icon} size={24} color={option.color} />
              </View>
              <Text style={styles.measurementTitle}>{option.title}</Text>
              <Text style={styles.measurementSubtitle}>{option.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Measurements</Text>
          
          {/* Empty state for now */}
          <View style={styles.emptyState}>
            <Icon name="chart-line" size={48} color={colors.secondary} />
            <Text style={styles.emptyText}>
              No recent measurements.{'\n'}Start tracking your health metrics above!
            </Text>
          </View>

          {/* Example of how recent measurements would look */}
          {/* 
          <View style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Heart Rate</Text>
              <Text style={styles.recentTime}>2 hours ago</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.recentValue}>72</Text>
              <Text style={styles.recentUnit}>bpm</Text>
            </View>
          </View>
          */}
        </View>
      </ScrollView>

      {/* Food Scanner Modal */}
      <Modal
        visible={showFoodScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeFoodScanner}
      >
        <SafeAreaView style={styles.foodScannerModal}>
          {/* Header */}
          <View style={styles.scannerHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeFoodScanner}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Food Scanner</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.scannerContent}>
            {/* Step 1: Image Capture */}
            {!capturedImage && (
              <View style={styles.captureSection}>
                <TouchableOpacity 
                  style={styles.captureButton} 
                  onPress={() => setShowImagePickerModal(true)}
                  disabled={isProcessing}
                >
                  <Icon name="camera" size={24} color="white" />
                  <Text style={styles.captureButtonText}>Scan Your Food</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Display captured image */}
            {capturedImage && (
              <View style={styles.imageSection}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: capturedImage }} style={styles.foodImage} resizeMode="cover" />
                </View>
                <View style={styles.imageActions}>
                  <TouchableOpacity 
                    style={styles.retakeButton} 
                    onPress={() => setShowImagePickerModal(true)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.retakeButtonText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Loading indicator */}
            {isProcessing && (
              <View style={styles.loadingSection}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>{processingMessage}</Text>
              </View>
            )}

            {/* Step 3: Display prediction results */}
            {predictionData && predictionData.nutrients && !isProcessing && (
              <View style={styles.predictionSection}>
                <Text style={styles.sectionTitle}>Predicted Nutrients</Text>
                <Text style={styles.nutrientSubtitle}>Tap any value to edit</Text>
                <View style={styles.nutrientsGrid}>
                  {Object.entries(editableNutrients).map(([key, value]) => {
                    const nutrientInfo = getNutrientIcon(key);
                    return (
                      <View key={key} style={styles.nutrientCard}>
                        <View style={styles.nutrientHeader}>
                          <View style={[styles.nutrientIcon, { backgroundColor: `${nutrientInfo.color}15` }]}>
                            <Icon name={nutrientInfo.icon} size={16} color={nutrientInfo.color} />
                          </View>
                          <Text style={styles.nutrientLabel}>{key}</Text>
                        </View>
                        <TextInput
                          style={[
                            styles.nutrientInput,
                            focusedNutrient === key && styles.nutrientInputFocused
                          ]}
                          value={String(value)}
                          onChangeText={(text) => {
                            // Try to parse as number, fallback to string
                            const numValue = parseFloat(text);
                            const finalValue = isNaN(numValue) ? text : numValue;
                            handleNutrientChange(key, finalValue);
                          }}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.secondary}
                          onFocus={() => setFocusedNutrient(key)}
                          onBlur={() => setFocusedNutrient(null)}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 4: Meal details form */}
            {predictionData && predictionData.nutrients && !isProcessing && (
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Meal Details</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Meal Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Chicken Caesar Salad"
                    value={mealDetails.mealName}
                    onChangeText={(text) => setMealDetails(prev => ({ ...prev, mealName: text }))}
                    placeholderTextColor={colors.secondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Food Type</Text>
                  <TouchableOpacity 
                    style={styles.dropdownButton}
                    onPress={() => setShowFoodTypeModal(true)}
                  >
                    <Text style={styles.dropdownText}>
                      {foodTypes.find(type => type.value === mealDetails.foodType)?.label || 'Select Food Type'}
                    </Text>
                    <Icon name="chevron-down" size={20} color={colors.secondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.notesInput]}
                    placeholder="Add any additional notes about this meal..."
                    value={mealDetails.notes}
                    onChangeText={(text) => setMealDetails(prev => ({ ...prev, notes: text }))}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={colors.secondary}
                  />
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={closeFoodScanner}
                    disabled={isProcessing}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.saveButton} 
                    onPress={saveMeal}
                    disabled={isProcessing}
                  >
                    <Text style={styles.buttonText}>Save Meal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Image picker modal */}
      {!showFoodScanner && (
        <Modal
          visible={showImagePickerModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowImagePickerModal(false)}
        >
          <View style={styles.imagePickerModalOverlay}>
            <View style={styles.imagePickerModalContent}>
              <Text style={styles.imagePickerModalTitle}>Select Image</Text>
              
              <TouchableOpacity style={styles.modalButton} onPress={handleCameraCapture}>
                <Icon name="camera" size={24} color="white" />
                <Text style={styles.modalButtonText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalButton} onPress={handleLibrarySelection}>
                <Icon name="image" size={24} color="white" />
                <Text style={styles.modalButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowImagePickerModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Image picker modal for food scanner */}
      {showFoodScanner && (
        <Modal
          visible={showImagePickerModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowImagePickerModal(false)}
        >
          <View style={styles.imagePickerModalOverlay}>
            <View style={styles.imagePickerModalContent}>
              <Text style={styles.imagePickerModalTitle}>Select Image</Text>
              
              <TouchableOpacity style={styles.modalButton} onPress={handleCameraCapture}>
                <Icon name="camera" size={24} color="white" />
                <Text style={styles.modalButtonText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalButton} onPress={handleLibrarySelection}>
                <Icon name="image" size={24} color="white" />
                <Text style={styles.modalButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowImagePickerModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Food Type Selection Modal */}
      <Modal
        visible={showFoodTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFoodTypeModal(false)}
      >
        <View style={styles.imagePickerModalOverlay}>
          <View style={styles.imagePickerModalContent}>
            <Text style={styles.imagePickerModalTitle}>Select Food Type</Text>
            
            {foodTypes.map(type => (
              <TouchableOpacity 
                key={type.value}
                style={styles.modalButton} 
                onPress={() => {
                  setMealDetails(prev => ({ ...prev, foodType: type.value }));
                  setShowFoodTypeModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity 
              style={styles.modalCancelButton} 
              onPress={() => setShowFoodTypeModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MeasureScreen;
