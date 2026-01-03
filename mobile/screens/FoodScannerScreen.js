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

const FoodScannerScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  // Food scanner state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showFoodTypeModal, setShowFoodTypeModal] = useState(false);
  const [editableNutrients, setEditableNutrients] = useState({});
  const [focusedNutrient, setFocusedNutrient] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [foodDescription, setFoodDescription] = useState('');
  const [showAnalyzeButton, setShowAnalyzeButton] = useState(false);
  
  // Meal details state
  const [mealDetails, setMealDetails] = useState({
    mealName: '',
    foodType: 'unlabeled',
    notes: '',
    nutrients: null,
    servingSize: '',
    confidenceRate: 0
  });

  // Base nutrients from initial prediction (before any portion adjustments)
  const [baseNutrients, setBaseNutrients] = useState(null);
  
  // Portion multiplier for recalculating nutrients
  const [portionMultiplier, setPortionMultiplier] = useState(1);

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
      'protein_g': { icon: 'dumbbell', color: '#E67E22' },
      'carbohydrates': { icon: 'grain', color: '#F39C12' },
      'carbs': { icon: 'grain', color: '#F39C12' },
      'carbs_g': { icon: 'grain', color: '#F39C12' },
      'fat': { icon: 'water-outline', color: '#9B59B6' },
      'fat_g': { icon: 'water-outline', color: '#9B59B6' },
      'total_fat': { icon: 'water-outline', color: '#9B59B6' },
      'saturated_fat': { icon: 'water-alert', color: '#8E44AD' },
      'saturated_fat_g': { icon: 'water-alert', color: '#8E44AD' },
      'unsaturated_fat': { icon: 'oil', color: '#A569BD' },
      'unsaturated_fat_g': { icon: 'oil', color: '#A569BD' },
      'fiber': { icon: 'leaf', color: '#27AE60' },
      'fiber_g': { icon: 'leaf', color: '#27AE60' },
      'sugar': { icon: 'cube-outline', color: '#E91E63' },
      'added_sugars': { icon: 'cube-outline', color: '#E91E63' },
      'added_sugars_g': { icon: 'cube-outline', color: '#E91E63' },
      
      // Glycemic Load
      'glycemic_load': { icon: 'chart-line', color: '#FF6347' },
      'glycemic_index': { icon: 'chart-bell-curve', color: '#FF7F50' },
      
      // Minerals
      'sodium': { icon: 'shaker-outline', color: '#95A5A6' },
      'sodium_mg': { icon: 'shaker-outline', color: '#95A5A6' },
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

  // Merge duplicate recipes (same label, different boxes)
  const mergeRecipes = (recipesList) => {
    if (!recipesList || !Array.isArray(recipesList)) return [];
    const merged = {};
    recipesList.forEach(recipe => {
      const label = recipe.label;
      if (!merged[label]) {
        merged[label] = {
          label: label,
          boxes: [recipe.box_2d]
        };
      } else {
        merged[label].boxes.push(recipe.box_2d);
      }
    });
    return Object.values(merged);
  };

  // Get merged recipes
  const getMergedRecipes = () => {
    return mergeRecipes(recipes);
  };

  // Generate consistent color for each ingredient
  const getIngredientColor = (label) => {
    const colors = [
      '#27AE60', '#3498DB', '#E74C3C', '#F39C12', '#9B59B6',
      '#1ABC9C', '#E67E22', '#34495E', '#16A085', '#2980B9',
      '#8E44AD', '#2C3E50', '#D35400', '#C0392B'
    ];
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Close scanner
  const closeFoodScanner = () => {
    Alert.alert(
      'Close Food Scanner',
      'Are you sure you want to close? Any unsaved data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  const resetFoodScannerState = () => {
    setCapturedImage(null);
    setPredictionData(null);
    setEditableNutrients({});
    setBaseNutrients(null);
    setPortionMultiplier(1);
    setFocusedNutrient(null);
    setRecipes([]);
    setFoodDescription('');
    setShowAnalyzeButton(false);
    setMealDetails({
      mealName: '',
      foodType: 'unlabeled',
      notes: '',
      nutrients: null,
      servingSize: '',
      confidenceRate: 0
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
    resetFoodScannerState();
    
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        setShowAnalyzeButton(true);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      toast.error('Failed to capture image. Please try again.');
    }
  };

  // Handle image selection from library
  const handleLibrarySelection = async () => {
    setShowImagePickerModal(false);
    resetFoodScannerState();
    
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        setShowAnalyzeButton(true);
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
    setShowAnalyzeButton(false);
    
    try {
      console.log('Starting image processing...');
      console.log('Food description:', foodDescription);
      const response = await api.predictNutrientsOnly(imageUri, foodDescription);
      console.log('API response:', response);
      
      // Check if food was successfully detected
      if (response && response.success && response.data) {
        console.log('Setting prediction data:', response.data);
        console.log('temp_image_public_id:', response.data.temp_image_public_id);
        console.log('temp_image_url:', response.data.temp_image_url);
        
        setPredictionData(response.data);
        setEditableNutrients(response.data.nutrients || {});
        setBaseNutrients(response.data.nutrients || {}); // Store base nutrients for portion calculations
        setPortionMultiplier(1); // Reset portion multiplier
        setRecipes(response.data.recipes || []);
        setMealDetails(prev => ({
          ...prev,
          mealName: response.data.meal_name || '',
          nutrients: response.data.nutrients,
          servingSize: response.data.serving_size || '',
          confidenceRate: response.data.confidence_percentage || 0
        }));
        
        toast.success('Food analysis complete! Review and edit the details below.');
      } else {
        // Handle case when no food is detected
        console.log('API response failed - no food detected:', response);
        
        // Display appropriate error message
        const errorMessage = response?.message || response?.error || 'Failed to analyze food image';
        toast.error(errorMessage);
        
        // Clear the captured image so user can try again
        setCapturedImage(null);
        
        // Show helpful alert with more context
        Alert.alert(
          'No Food Detected',
          response?.message || 'Unable to identify food in this image. Please ensure:\n\n• The image shows food clearly\n• Good lighting conditions\n• Food is in focus\n• Try a different angle',
          [
            {
              text: 'Try Again',
              onPress: () => setShowImagePickerModal(true)
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error processing image:', error);
      
      // Check if error response contains food detection failure
      const errorResponse = error.response?.data;
      if (errorResponse && !errorResponse.success && errorResponse.error) {
        toast.error(errorResponse.message || errorResponse.error);
        
        Alert.alert(
          'No Food Detected',
          errorResponse.message || 'Unable to identify food in this image. Please try again with a clearer image of food.',
          [
            {
              text: 'Try Again',
              onPress: () => setShowImagePickerModal(true)
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      } else {
        toast.error('Failed to analyze food. Please check your connection and try again.');
      }
      
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
      console.log('Saving meal with temp_image_public_id:', predictionData.temp_image_public_id);
      
      const response = await api.saveMeal(
        editableNutrients,
        mealDetails.mealName.trim(),
        mealDetails.foodType,
        mealDetails.notes.trim(),
        predictionData.temp_image_public_id,
        mealDetails.servingSize,
        mealDetails.confidenceRate,
        recipes
      );

      console.log('Save meal response:', response);

      if (response.success) {
        console.log('Meal saved with image_url:', response.data?.image_url);
        toast.success('Meal saved successfully!');
        navigation.goBack();
      } else {
        console.error('Save meal failed:', response.error);
        toast.error(response.error || 'Failed to save meal');
      }
    } catch (error) {
      console.error('Error saving meal:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to save meal. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Handle nutrient value changes
  const handleNutrientChange = (nutrientKey, value) => {
    setEditableNutrients(prev => ({
      ...prev,
      [nutrientKey]: value
    }));
  };

  // Recalculate nutrients based on portion multiplier
  const recalculateNutrients = (multiplier) => {
    if (!baseNutrients) return;
    
    const adjusted = {};
    Object.entries(baseNutrients).forEach(([key, value]) => {
      if (typeof value === 'number') {
        adjusted[key] = Math.round((value * multiplier) * 100) / 100; // Round to 2 decimals
      } else {
        adjusted[key] = value;
      }
    });
    
    setEditableNutrients(adjusted);
    setPortionMultiplier(multiplier);
  };

  const getIconBackgroundStyle = (color) => ({
    backgroundColor: `${color}15`
  });

  const styles = StyleSheet.create({
    container: {
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
      position: 'relative',
    },
    foodImage: {
      width: '100%',
      aspectRatio: 1,
      minHeight: 250,
      maxHeight: 400,
    },
    boundingBoxContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      pointerEvents: 'none',
    },
    boundingBox: {
      position: 'absolute',
      borderWidth: 2,
      borderRadius: 4,
    },
    boundingBoxLabel: {
      position: 'absolute',
      top: -2,
      left: -2,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderTopLeftRadius: 4,
      maxWidth: 120,
    },
    boundingBoxText: {
      color: 'white',
      fontSize: 8,
      fontWeight: '600',
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
    
    // Food Description Section
    foodDescriptionSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 24,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    foodDescriptionHint: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 12,
      lineHeight: 20,
    },
    foodDescriptionInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      minHeight: 80,
      marginBottom: 16,
      textAlignVertical: 'top',
    },
    descriptionActions: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    retakeSmallButton: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      flex: 1,
    },
    retakeSmallButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    analyzeButton: {
      backgroundColor: '#27AE60',
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      flex: 2,
    },
    analyzeButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
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
    
    // Analysis information section
    analysisInfoSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoCard: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 8,
    },
    infoValue: {
      fontSize: 16,
      color: colors.primary,
      marginTop: 4,
    },
    confidenceContainer: {
      marginTop: 4,
    },
    confidenceValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    confidenceBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    confidenceBarFill: {
      height: '100%',
      borderRadius: 4,
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
    /* Recipes Section Styles */
    recipesSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recipeSubtitle: {
      fontSize: 14,
      color: colors.secondary,
      marginBottom: 16,
      fontStyle: 'italic',
    },
    recipesList: {
      gap: 12,
    },
    recipeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recipeIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#27AE6015',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    recipeInfo: {
      flex: 1,
    },
    recipeLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    recipeCount: {
      fontSize: 12,
      color: colors.secondary,
    },
    recipeBoundingBox: {
      fontSize: 11,
      color: colors.secondary,
      fontFamily: 'monospace',
    },
    /* Portion Size Adjustment Styles */
    portionSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    portionAdjustmentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 16,
      gap: 12,
    },
    portionButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      width: 48,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    },
    portionInputContainer: {
      flex: 1,
      alignItems: 'center',
    },
    portionInput: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 8,
      padding: 10,
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      backgroundColor: colors.background,
      textAlign: 'center',
      width: '100%',
    },
    portionLabel: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 4,
      fontWeight: '500',
    },
    portionHints: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    hintItem: {
      alignItems: 'center',
      flex: 1,
    },
    hintLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 2,
    },
    hintText: {
      fontSize: 11,
      color: colors.secondary,
    },
  });

  // Show image picker modal when screen first loads
  React.useEffect(() => {
    setShowImagePickerModal(true);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
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
              <Image 
                source={{ uri: capturedImage }} 
                style={styles.foodImage} 
                resizeMode="cover"
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setImageLayout({ width, height });
                }}
              />
              {/* Draw bounding boxes on image */}
              {recipes.length > 0 && imageLayout.width > 0 && (
                <View style={[styles.boundingBoxContainer, { width: imageLayout.width, height: imageLayout.height }]}>
                  {recipes.map((recipe, index) => {
                    if (!recipe.box_2d || recipe.box_2d.length !== 4) return null;
                    const [x_min, y_min, x_max, y_max] = recipe.box_2d;
                    const ingredientColor = getIngredientColor(recipe.label);
                    // Assume original image is around 1000x1000, scale to actual display size
                    const scaleX = imageLayout.width / 1000;
                    const scaleY = imageLayout.height / 1000;
                    const left = x_min * scaleX;
                    const top = y_min * scaleY;
                    const width = (x_max - x_min) * scaleX;
                    const height = (y_max - y_min) * scaleY;
                    
                    return (
                      <View
                        key={index}
                        style={[
                          styles.boundingBox,
                          {
                            left,
                            top,
                            width,
                            height,
                            borderColor: ingredientColor,
                            backgroundColor: `${ingredientColor}15`,
                          }
                        ]}
                      >
                        <View style={[styles.boundingBoxLabel, { backgroundColor: ingredientColor }]}>
                          <Text style={styles.boundingBoxText} numberOfLines={1}>
                            {recipe.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
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

        {/* Step 2.5: Food Description Input (shown after image capture, before analysis) */}
        {capturedImage && showAnalyzeButton && !isProcessing && !predictionData && (
          <View style={styles.foodDescriptionSection}>
            <Text style={styles.sectionTitle}>Describe Your Food (Optional)</Text>
            <Text style={styles.foodDescriptionHint}>
              Provide details about your food for better nutrient analysis (e.g., "grilled chicken breast", "chocolate chip cookie", "large pizza slice")
            </Text>
            <TextInput
              style={styles.foodDescriptionInput}
              value={foodDescription}
              onChangeText={setFoodDescription}
              placeholder="e.g., grilled salmon with vegetables"
              placeholderTextColor={colors.secondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.descriptionActions}>
              <TouchableOpacity 
                style={styles.retakeSmallButton}
                onPress={() => {
                  setShowImagePickerModal(true);
                  setFoodDescription('');
                }}
              >
                <Icon name="camera-retake" size={20} color={colors.text} />
                <Text style={styles.retakeSmallButtonText}>Change Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.analyzeButton}
                onPress={() => processImage(capturedImage)}
              >
                <Icon name="magnify-scan" size={22} color="white" />
                <Text style={styles.analyzeButtonText}>Analyze Food</Text>
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
          <>
            {/* Analysis Information */}
            <View style={styles.analysisInfoSection}>
              <Text style={styles.sectionTitle}>Analysis Results</Text>
              
              {/* Serving Size */}
              {mealDetails.servingSize && (
                <View style={styles.infoCard}>
                  <View style={styles.infoHeader}>
                    <Icon name="food-variant" size={20} color="#3498DB" />
                    <Text style={styles.infoLabel}>Serving Size</Text>
                  </View>
                  <Text style={styles.infoValue}>{mealDetails.servingSize}</Text>
                </View>
              )}
              
              {/* Confidence Rate */}
              <View style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <Icon name="shield-check" size={20} color={
                    mealDetails.confidenceRate >= 70 ? '#27AE60' :
                    mealDetails.confidenceRate >= 50 ? '#F39C12' : '#E74C3C'
                  } />
                  <Text style={styles.infoLabel}>Confidence</Text>
                </View>
                <View style={styles.confidenceContainer}>
                  <Text style={[
                    styles.confidenceValue,
                    {
                      color: mealDetails.confidenceRate >= 70 ? '#27AE60' :
                             mealDetails.confidenceRate >= 50 ? '#F39C12' : '#E74C3C'
                    }
                  ]}>
                    {mealDetails.confidenceRate.toFixed(0)}%
                  </Text>
                  <View style={styles.confidenceBar}>
                    <View style={[
                      styles.confidenceBarFill,
                      {
                        width: `${mealDetails.confidenceRate}%`,
                        backgroundColor: mealDetails.confidenceRate >= 70 ? '#27AE60' :
                                       mealDetails.confidenceRate >= 50 ? '#F39C12' : '#E74C3C'
                      }
                    ]} />
                  </View>
                </View>
              </View>
            </View>

            {/* Predicted Nutrients */}
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

          {/* Detected Ingredients/Recipes */}
          {recipes && recipes.length > 0 && (
            <View style={styles.recipesSection}>
              <Text style={styles.sectionTitle}>Detected Ingredients</Text>
              <Text style={styles.recipeSubtitle}>
                {getMergedRecipes().length} unique ingredient{getMergedRecipes().length !== 1 ? 's' : ''} detected
              </Text>
              <View style={styles.recipesList}>
                {getMergedRecipes().map((recipe, index) => (
                  <View key={index} style={styles.recipeCard}>
                    <View style={styles.recipeIconContainer}>
                      <Icon name="food-variant" size={20} color="#27AE60" />
                    </View>
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeLabel}>{recipe.label}</Text>
                      <Text style={styles.recipeCount}>
                        {recipe.boxes.length} location{recipe.boxes.length !== 1 ? 's' : ''} detected
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Portion Size Adjustment */}
          <View style={styles.portionSection}>
            <Text style={styles.sectionTitle}>Adjust Portion Size</Text>
            <Text style={styles.nutrientSubtitle}>
              Original serving: {mealDetails.servingSize}
            </Text>
            
            <View style={styles.portionAdjustmentContainer}>
              <TouchableOpacity 
                style={styles.portionButton}
                onPress={() => recalculateNutrients(Math.max(0.25, portionMultiplier - 0.25))}
              >
                <Icon name="minus" size={20} color="white" />
              </TouchableOpacity>
              
              <View style={styles.portionInputContainer}>
                <TextInput
                  style={styles.portionInput}
                  value={portionMultiplier.toFixed(2)}
                  onChangeText={(text) => {
                    const value = parseFloat(text);
                    if (!isNaN(value) && value > 0) {
                      recalculateNutrients(value);
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={colors.secondary}
                />
                <Text style={styles.portionLabel}>x portion</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.portionButton}
                onPress={() => recalculateNutrients(portionMultiplier + 0.25)}
              >
                <Icon name="plus" size={20} color="white" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.portionHints}>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>0.5x</Text>
                <Text style={styles.hintText}>Half</Text>
              </View>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>1.0x</Text>
                <Text style={styles.hintText}>Normal</Text>
              </View>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>1.5x</Text>
                <Text style={styles.hintText}>1.5x</Text>
              </View>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>2.0x</Text>
                <Text style={styles.hintText}>Double</Text>
              </View>
            </View>
          </View>
          </>
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
              <Text style={styles.label}>Serving Size</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1 cup, 100g"
                value={mealDetails.servingSize}
                onChangeText={(text) => setMealDetails(prev => ({ ...prev, servingSize: text }))}
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

      {/* Image picker modal - shown directly when Food Scanner is clicked */}
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
              onPress={() => {
                setShowImagePickerModal(false);
                if (!capturedImage) {
                  navigation.goBack();
                }
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

export default FoodScannerScreen;
