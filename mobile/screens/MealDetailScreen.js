import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';

const MealDetailScreen = ({ route, navigation }) => {
  const { meal: initialMeal } = route.params;
  const { colors } = useTheme();
  const toast = useToast();

  const [meal, setMeal] = useState(initialMeal);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMealName, setEditedMealName] = useState(meal.meal_name);
  const [editedNotes, setEditedNotes] = useState(meal.notes || '');
  const [editedFoodType, setEditedFoodType] = useState(meal.food_type || 'unlabeled');
  const [showFoodTypeModal, setShowFoodTypeModal] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [baseNutrients, setBaseNutrients] = useState(meal.nutrients || null);
  const [portionMultiplier, setPortionMultiplier] = useState(1);
  const [editableNutrients, setEditableNutrients] = useState(meal.nutrients || {});
  const [originalServingSize, setOriginalServingSize] = useState(null);

  // Ingredient nutrients state
  const [ingredientNutrients, setIngredientNutrients] = useState(meal.ingredient_nutrients || []);
  const [ingredientProportions, setIngredientProportions] = useState(meal.ingredient_proportions || {});
  const [baseIngredientNutrients, setBaseIngredientNutrients] = useState(meal.ingredient_nutrients || []);
  const [showIngredientModal, setShowIngredientModal] = useState(false);

  // Fetch complete meal data on mount to ensure we have ingredient_nutrients
  useEffect(() => {
    const fetchMealData = async () => {
      try {
        // Use 'id' field instead of '_id' as that's what the backend returns
        const mealId = initialMeal.id || initialMeal._id;
        const response = await api.getMealById(mealId);

        // Backend returns meal in 'data' field, not 'meal'
        if (response.success && response.data) {
          console.log('Fetched meal data:', response.data);
          console.log('Ingredient nutrients:', response.data.ingredient_nutrients);
          console.log('Ingredient proportions:', response.data.ingredient_proportions);

          // Convert 'id' to '_id' for compatibility with existing code
          const mealData = { ...response.data, _id: response.data.id };
          setMeal(mealData);

          // Update ingredient states if available
          if (response.data.ingredient_nutrients) {
            setIngredientNutrients(response.data.ingredient_nutrients);
            setBaseIngredientNutrients(response.data.ingredient_nutrients);
          }
          if (response.data.ingredient_proportions) {
            setIngredientProportions(response.data.ingredient_proportions);
          }
        }
      } catch (error) {
        console.error('Error fetching meal details:', error);
        // Don't show error to user, just use the initial meal data
      }
    };

    fetchMealData();
  }, [initialMeal.id, initialMeal._id]);

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
    return mergeRecipes(meal.recipes || []);
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

  // Food type info
  const getFoodTypeInfo = (foodType) => {
    const typeMap = {
      'breakfast': { icon: 'coffee', color: '#F39C12', label: 'Breakfast' },
      'lunch': { icon: 'food', color: '#E74C3C', label: 'Lunch' },
      'dinner': { icon: 'silverware-fork-knife', color: '#9B59B6', label: 'Dinner' },
      'snacks': { icon: 'cookie', color: '#27AE60', label: 'Snacks' },
      'drinks': { icon: 'cup', color: '#3498DB', label: 'Drinks' },
      'dessert': { icon: 'cake', color: '#E91E63', label: 'Dessert' },
      'other': { icon: 'food-variant', color: '#95A5A6', label: 'Other' },
      'unlabeled': { icon: 'help', color: '#BDC3C7', label: 'Unlabeled' },
    };
    return typeMap[foodType] || typeMap['unlabeled'];
  };

  // Get nutrient icon and color (same as MeasureScreen)
  const getNutrientIcon = (nutrientKey) => {
    const nutrientMap = {
      'calories': { icon: 'fire', color: '#E74C3C' },
      'energy': { icon: 'fire', color: '#E74C3C' },
      'kcal': { icon: 'fire', color: '#E74C3C' },
      'protein': { icon: 'dumbbell', color: '#E67E22' },
      'carbohydrates': { icon: 'grain', color: '#F39C12' },
      'carbs': { icon: 'grain', color: '#F39C12' },
      'fat': { icon: 'water-outline', color: '#9B59B6' },
      'total_fat': { icon: 'water-outline', color: '#9B59B6' },
      'saturated_fat': { icon: 'water-alert', color: '#8E44AD' },
      'fiber': { icon: 'leaf', color: '#27AE60' },
      'sugar': { icon: 'cube-outline', color: '#E91E63' },
      'sodium': { icon: 'shaker-outline', color: '#95A5A6' },
      'calcium': { icon: 'bone', color: '#ECF0F1' },
      'iron': { icon: 'anvil', color: '#34495E' },
      'potassium': { icon: 'lightning-bolt', color: '#F1C40F' },
      'magnesium': { icon: 'magnet', color: '#7F8C8D' },
      'zinc': { icon: 'chemical-weapon', color: '#BDC3C7' },
      'vitamin_a': { icon: 'eye', color: '#FF6B35' },
      'vitamin_c': { icon: 'citrus-slice', color: '#FFA500' },
      'vitamin_d': { icon: 'white-balance-sunny', color: '#FFD700' },
      'vitamin_e': { icon: 'alpha-e', color: '#90EE90' },
      'vitamin_k': { icon: 'alpha-k', color: '#006400' },
      'default': { icon: 'nutrition', color: '#3498DB' }
    };

    const key = nutrientKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return nutrientMap[key] || nutrientMap['default'];
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Handle meal update
  const handleUpdateMeal = async () => {
    if (!editedMealName.trim()) {
      Alert.alert('Error', 'Meal name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      // Calculate updated serving size based on original serving size
      let updatedServingSize = originalServingSize || meal.serving_size;
      if (portionMultiplier !== 1 && updatedServingSize) {
        updatedServingSize = `${portionMultiplier.toFixed(2)}× (${originalServingSize || meal.serving_size})`;
      }

      const response = await api.updateMeal(
        meal.id,
        editedMealName.trim(),
        editedNotes.trim(),
        editedFoodType,
        editableNutrients,
        updatedServingSize,
        ingredientNutrients,
        ingredientProportions
      );

      if (response.success) {
        setMeal(prev => ({
          ...prev,
          meal_name: editedMealName.trim(),
          notes: editedNotes.trim(),
          food_type: editedFoodType,
          nutrients: editableNutrients,
          serving_size: updatedServingSize,
          ingredient_nutrients: ingredientNutrients,
          ingredient_proportions: ingredientProportions
        }));
        setBaseNutrients(editableNutrients);
        setBaseIngredientNutrients(ingredientNutrients);
        setIsEditing(false);
        toast.success('Meal updated successfully');
      } else {
        toast.error(response.error || 'Failed to update meal');
      }
    } catch (error) {
      console.error('Error updating meal:', error);
      toast.error('Failed to update meal');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle meal deletion
  const handleDeleteMeal = () => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await api.deleteMeal(meal.id);
              if (response.success) {
                toast.success('Meal deleted successfully');
                navigation.goBack();
              } else {
                toast.error(response.error || 'Failed to delete meal');
              }
            } catch (error) {
              console.error('Error deleting meal:', error);
              toast.error('Failed to delete meal');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditedMealName(meal.meal_name);
    setEditedNotes(meal.notes || '');
    setEditedFoodType(meal.food_type || 'unlabeled');
    setEditableNutrients(meal.nutrients || {});
    setPortionMultiplier(1);
    setIsEditing(false);
  };

  // Initialize base nutrients when meal changes
  React.useEffect(() => {
    if (meal.nutrients) {
      setBaseNutrients(meal.nutrients);
      setEditableNutrients(meal.nutrients);
      setPortionMultiplier(1);
    }

    // Initialize ingredient nutrients
    if (meal.ingredient_nutrients) {
      setIngredientNutrients(meal.ingredient_nutrients);
      setBaseIngredientNutrients(meal.ingredient_nutrients);
    }

    // Initialize ingredient proportions
    if (meal.ingredient_proportions) {
      setIngredientProportions(meal.ingredient_proportions);
    } else if (meal.ingredient_nutrients && meal.ingredient_nutrients.length > 0) {
      // Initialize proportions to 1.0 for each ingredient
      const initialProportions = {};
      meal.ingredient_nutrients.forEach((ingredient) => {
        initialProportions[ingredient.ingredient || 'Unknown'] = 1.0;
      });
      setIngredientProportions(initialProportions);
    }

    // Extract original serving size (remove any existing multiplier)
    if (meal.serving_size) {
      // Check if serving_size has the pattern "X.XX× (original)"
      const match = meal.serving_size.match(/^[\d.]+×\s*\((.+)\)$/);
      if (match) {
        // Extract the original from inside parentheses
        setOriginalServingSize(match[1]);
      } else {
        // No multiplier, this is the original
        setOriginalServingSize(meal.serving_size);
      }
    }
  }, [meal.id]);

  // Recalculate nutrients based on portion multiplier
  const recalculateNutrients = (multiplier) => {
    if (!baseNutrients) return;

    const recalculated = {};
    Object.entries(baseNutrients).forEach(([key, value]) => {
      if (typeof value === 'number') {
        recalculated[key] = value * multiplier;
      } else {
        recalculated[key] = value;
      }
    });

    setEditableNutrients(recalculated);
    setPortionMultiplier(multiplier);
  };

  // Handle ingredient proportion change and recalculate
  const handleIngredientProportionChange = (ingredientName, proportion, shouldRecalculate = false) => {
    const newProportions = {
      ...ingredientProportions,
      [ingredientName]: parseFloat(proportion) || 0
    };
    setIngredientProportions(newProportions);

    if (shouldRecalculate) {
      recalculateFromIngredients(portionMultiplier, newProportions);
    }
  };

  // Recalculate nutrients from ingredient proportions
  const recalculateFromIngredients = (overallMultiplier = portionMultiplier, updatedProportions = null) => {
    const proportionsToUse = updatedProportions || ingredientProportions;

    if (baseIngredientNutrients.length === 0) {
      return;
    }

    // Calculate nutrients based on ingredient proportions
    const updatedIngredients = baseIngredientNutrients.map(ingredient => {
      const proportion = proportionsToUse[ingredient.ingredient] || 1.0;
      const adjustedNutrients = {};

      Object.keys(ingredient.nutrients).forEach(key => {
        adjustedNutrients[key] = parseFloat((ingredient.nutrients[key] * proportion * overallMultiplier).toFixed(2));
      });

      return {
        ...ingredient,
        nutrients: adjustedNutrients,
        proportion: proportion
      };
    });

    setIngredientNutrients(updatedIngredients);

    // Sum up all ingredient nutrients to get overall meal nutrients
    const totalNutrients = {};
    updatedIngredients.forEach(ingredient => {
      Object.keys(ingredient.nutrients).forEach(key => {
        if (!totalNutrients[key]) {
          totalNutrients[key] = 0;
        }
        totalNutrients[key] += ingredient.nutrients[key];
      });
    });

    // Round to 2 decimal places
    Object.keys(totalNutrients).forEach(key => {
      totalNutrients[key] = parseFloat(totalNutrients[key].toFixed(2));
    });

    setEditableNutrients(totalNutrients);
  };

  const foodTypeInfo = getFoodTypeInfo(meal.food_type);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: `${colors.primary}15`,
    },
    headerActions: {
      flexDirection: 'row',
    },
    actionButton: {
      padding: 8,
      borderRadius: 20,
      marginLeft: 8,
    },
    editButton: {
      backgroundColor: `${colors.primary}15`,
    },
    deleteButton: {
      backgroundColor: `#E74C3C15`,
    },
    saveButton: {
      backgroundColor: `#27AE6015`,
    },
    cancelButton: {
      backgroundColor: `${colors.secondary}15`,
    },
    content: {
      flex: 1,
    },
    imageSection: {
      padding: 16,
    },
    imageContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.border,
      position: 'relative',
    },
    mealImage: {
      width: '100%',
      aspectRatio: 1,
      minHeight: 250,
      maxHeight: 400,
      borderRadius: 12,
      backgroundColor: colors.border,
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
    noImageContainer: {
      height: 250,
      borderRadius: 12,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mealInfoSection: {
      padding: 16,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mealName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    mealNameInput: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    dateTimeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    dateTimeText: {
      fontSize: 16,
      color: colors.secondary,
      marginLeft: 8,
    },
    foodTypeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    foodTypeSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
    },
    foodTypeIcon: {
      padding: 8,
      borderRadius: 20,
      marginRight: 12,
    },
    foodTypeText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    servingSizeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 8,
      paddingVertical: 8,
      backgroundColor: '#3498DB10',
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#3498DB',
      flexWrap: 'wrap',
    },
    servingSizeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 8,
      marginRight: 4,
    },
    servingSizeValue: {
      fontSize: 14,
      fontWeight: '700',
      color: '#3498DB',
      flex: 1,
      flexWrap: 'wrap',
    },
    confidenceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 8,
      borderLeftWidth: 3,
      flexWrap: 'wrap',
    },
    confidenceLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 8,
      marginRight: 4,
    },
    confidenceValue: {
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
      flexWrap: 'wrap',
    },
    notesSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    notesTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    notesText: {
      fontSize: 16,
      color: colors.secondary,
      lineHeight: 22,
    },
    notesInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      textAlignVertical: 'top',
      height: 80,
    },
    noNotesText: {
      fontSize: 16,
      color: colors.secondary,
      fontStyle: 'italic',
    },
    nutrientsSection: {
      padding: 16,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
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
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    loadingContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.text,
    },
    recipesSection: {
      padding: 16,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      borderRadius: 12,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '70%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalOptionSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: `${colors.primary}10`,
    },
    modalOptionIcon: {
      padding: 8,
      borderRadius: 20,
      marginRight: 12,
    },
    modalOptionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    modalCloseButton: {
      backgroundColor: colors.secondary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 12,
    },
    modalCloseText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    portionSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
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
    ingredientModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    ingredientModalContent: {
      backgroundColor: colors.card,
      borderRadius: 20,
      width: '100%',
      maxHeight: '80%',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    ingredientModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ingredientModalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    ingredientModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 12,
    },
    ingredientModalSubtitle: {
      fontSize: 14,
      color: colors.secondary,
      paddingHorizontal: 20,
      paddingTop: 12,
      fontStyle: 'italic',
    },
    ingredientModalScroll: {
      padding: 20,
    },
    ingredientModalCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ingredientModalCardHeader: {
      marginBottom: 12,
    },
    ingredientTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    ingredientName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 8,
      flex: 1,
    },
    ingredientServing: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 4,
    },
    ingredientPortionControl: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ingredientPortionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    ingredientPortionAdjuster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    portionSmallButton: {
      backgroundColor: colors.primary,
      borderRadius: 6,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ingredientPortionInput: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 6,
      padding: 8,
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
      backgroundColor: colors.card,
      textAlign: 'center',
      width: 70,
    },
    ingredientPortionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.secondary,
    },
    ingredientNutrientsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    ingredientNutrientItem: {
      width: '48%',
      marginRight: '2%',
      marginBottom: 8,
    },
    ingredientNutrientLabel: {
      fontSize: 11,
      color: colors.secondary,
      marginBottom: 2,
      textTransform: 'capitalize',
    },
    ingredientNutrientValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    ingredientModalFooter: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    ingredientModalCloseButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    ingredientModalCloseText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelEdit}
                disabled={isLoading}
              >
                <Icon name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleUpdateMeal}
                disabled={isLoading}
              >
                <Icon name="check" size={24} color="#27AE60" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => setIsEditing(true)}
                disabled={isLoading}
              >
                <Icon name="pencil" size={24} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDeleteMeal}
                disabled={isLoading}
              >
                <Icon name="delete" size={24} color="#E74C3C" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Meal Image */}
        <View style={styles.imageSection}>
          {meal.image_url ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: meal.image_url }}
                style={styles.mealImage}
                resizeMode="contain"
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setImageLayout({ width, height });
                }}
              />
              {/* Draw bounding boxes on image */}
              {meal.recipes && meal.recipes.length > 0 && imageLayout.width > 0 && (
                <View style={[styles.boundingBoxContainer, { width: imageLayout.width, height: imageLayout.height }]}>
                  {meal.recipes.map((recipe, index) => {
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
          ) : (
            <View style={styles.noImageContainer}>
              <Icon name="image-off" size={48} color={colors.secondary} />
              <Text style={{ color: colors.secondary, marginTop: 8 }}>No image available</Text>
            </View>
          )}
        </View>

        {/* Meal Information */}
        <View style={styles.mealInfoSection}>
          {isEditing ? (
            <TextInput
              style={styles.mealNameInput}
              value={editedMealName}
              onChangeText={setEditedMealName}
              placeholder="Meal name"
              placeholderTextColor={colors.secondary}
            />
          ) : (
            <Text style={styles.mealName}>{meal.meal_name}</Text>
          )}

          <View style={styles.dateTimeContainer}>
            <Icon name="calendar" size={16} color={colors.secondary} />
            <Text style={styles.dateTimeText}>
              {formatDate(meal.created_at)} at {formatTime(meal.created_at)}
            </Text>
          </View>

          <View style={styles.foodTypeContainer}>
            {isEditing ? (
              <TouchableOpacity
                style={styles.foodTypeSelector}
                onPress={() => setShowFoodTypeModal(true)}
              >
                <View style={[
                  styles.foodTypeIcon,
                  { backgroundColor: `${getFoodTypeInfo(editedFoodType).color}15` }
                ]}>
                  <Icon name={getFoodTypeInfo(editedFoodType).icon} size={20} color={getFoodTypeInfo(editedFoodType).color} />
                </View>
                <Text style={styles.foodTypeText}>{getFoodTypeInfo(editedFoodType).label}</Text>
                <Icon name="chevron-down" size={20} color={colors.secondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ) : (
              <>
                <View style={[
                  styles.foodTypeIcon,
                  { backgroundColor: `${foodTypeInfo.color}15` }
                ]}>
                  <Icon name={foodTypeInfo.icon} size={20} color={foodTypeInfo.color} />
                </View>
                <Text style={styles.foodTypeText}>{foodTypeInfo.label}</Text>
              </>
            )}
          </View>

          {/* Serving Size Section */}
          {meal.serving_size && (
            <View style={styles.servingSizeContainer}>
              <Icon name="bowl" size={16} color="#3498DB" />
              <Text style={styles.servingSizeLabel}>Serving Size:</Text>
              <Text style={styles.servingSizeValue}>{meal.serving_size}</Text>
            </View>
          )}

          {/* Confidence Rate Section */}
          {meal.confidence_rate !== undefined && meal.confidence_rate !== null && (
            <View style={[
              styles.confidenceContainer,
              {
                borderLeftColor: meal.confidence_rate >= 70 ? '#27AE60' :
                  meal.confidence_rate >= 50 ? '#F39C12' : '#E74C3C',
                backgroundColor: meal.confidence_rate >= 70 ? '#27AE6010' :
                  meal.confidence_rate >= 50 ? '#F39C1210' : '#E74C3C10',
              }
            ]}>
              <Icon name="shield-check" size={16} color={
                meal.confidence_rate >= 70 ? '#27AE60' :
                  meal.confidence_rate >= 50 ? '#F39C12' : '#E74C3C'
              } />
              <Text style={styles.confidenceLabel}>Detection Confidence:</Text>
              <Text style={[
                styles.confidenceValue,
                {
                  color: meal.confidence_rate >= 70 ? '#27AE60' :
                    meal.confidence_rate >= 50 ? '#F39C12' : '#E74C3C'
                }
              ]}>
                {meal.confidence_rate.toFixed(0)}%
              </Text>
            </View>
          )}

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            {isEditing ? (
              <TextInput
                style={styles.notesInput}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="Add notes about this meal..."
                placeholderTextColor={colors.secondary}
                multiline
              />
            ) : meal.notes ? (
              <Text style={styles.notesText}>{meal.notes}</Text>
            ) : (
              <Text style={styles.noNotesText}>No notes added</Text>
            )}
          </View>
        </View>

        {/* Portion Adjustment Section - Only in Edit Mode */}
        {isEditing && meal.nutrients && Object.keys(meal.nutrients).length > 0 && (
          <View style={styles.portionSection}>
            <Text style={styles.sectionTitle}>Adjust Portion Size</Text>
            <View style={styles.portionAdjustmentContainer}>
              <TouchableOpacity
                style={styles.portionButton}
                onPress={() => {
                  const newMultiplier = Math.max(0.25, portionMultiplier - 0.25);
                  recalculateNutrients(newMultiplier);
                }}
              >
                <Icon name="minus" size={24} color="white" />
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
                />
                <Text style={styles.portionLabel}>Portion Multiplier</Text>
              </View>

              <TouchableOpacity
                style={styles.portionButton}
                onPress={() => {
                  const newMultiplier = portionMultiplier + 0.25;
                  recalculateNutrients(newMultiplier);
                }}
              >
                <Icon name="plus" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.portionHints}>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>0.5×</Text>
                <Text style={styles.hintText}>Half</Text>
              </View>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>1.0×</Text>
                <Text style={styles.hintText}>Original</Text>
              </View>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>1.5×</Text>
                <Text style={styles.hintText}>1.5 Times</Text>
              </View>
              <View style={styles.hintItem}>
                <Text style={styles.hintLabel}>2.0×</Text>
                <Text style={styles.hintText}>Double</Text>
              </View>
            </View>
          </View>
        )}

        {/* Nutrients Section */}
        {meal.nutrients && Object.keys(meal.nutrients).length > 0 && (
          <View style={styles.nutrientsSection}>
            <View style={{ flexDirection: 'column', justifyContent: 'space-between', alignItems: 'left', marginBottom: 16 }}>
              <Text style={styles.sectionTitle}>Nutritional Information</Text>
              {isEditing && ingredientNutrients && ingredientNutrients.length > 0 && (
                <View style={styles.ingredientButtonSection}>
                  <TouchableOpacity
                    style={styles.modifyIngredientButton}
                    onPress={() => setShowIngredientModal(true)}
                  >
                    <Text style={styles.modifyIngredientButtonText}>
                      Modify Ingredient Portions ({ingredientNutrients.length} ingredients)
                    </Text>
                    <Icon name="chevron-right" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              )}
              {ingredientNutrients.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowIngredientModal(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#27AE6015',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#27AE60',
                  }}
                >
                  <Icon name="food-apple" size={16} color="#27AE60" />
                  <Text style={{ color: '#27AE60', marginLeft: 6, fontSize: 13, fontWeight: '600' }}>
                    Show Ingredients
                  </Text>
                </TouchableOpacity>
              )}
              {/* Ingredient Nutrients Button - Only in Edit Mode */}
            </View>
            {isEditing && portionMultiplier !== 1 && (
              <Text style={styles.nutrientSubtitle}>
                Adjusted for {portionMultiplier.toFixed(2)}× portion size
              </Text>
            )}
            <View style={styles.nutrientsGrid}>
              {Object.entries(isEditing ? editableNutrients : meal.nutrients).map(([key, value]) => {
                const nutrientInfo = getNutrientIcon(key);
                return (
                  <View key={key} style={styles.nutrientCard}>
                    <View style={styles.nutrientHeader}>
                      <View style={[
                        styles.nutrientIcon,
                        { backgroundColor: `${nutrientInfo.color}15` }
                      ]}>
                        <Icon name={nutrientInfo.icon} size={16} color={nutrientInfo.color} />
                      </View>
                      <Text style={styles.nutrientLabel}>{key}</Text>
                    </View>
                    <Text style={styles.nutrientValue}>
                      {typeof value === 'number' ? value.toFixed(1) : String(value)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recipes/Ingredients Section */}
        {meal.recipes && meal.recipes.length > 0 && (
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
      </ScrollView>

      {/* Food Type Selection Modal */}
      <Modal
        visible={showFoodTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFoodTypeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFoodTypeModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Meal Type</Text>
            <ScrollView>
              {foodTypes.map((type) => {
                const typeInfo = getFoodTypeInfo(type.value);
                return (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.modalOption,
                      editedFoodType === type.value && styles.modalOptionSelected
                    ]}
                    onPress={() => {
                      setEditedFoodType(type.value);
                      setShowFoodTypeModal(false);
                    }}
                  >
                    <View style={[
                      styles.modalOptionIcon,
                      { backgroundColor: `${typeInfo.color}15` }
                    ]}>
                      <Icon name={typeInfo.icon} size={24} color={typeInfo.color} />
                    </View>
                    <Text style={styles.modalOptionText}>{type.label}</Text>
                    {editedFoodType === type.value && (
                      <Icon name="check" size={24} color={colors.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFoodTypeModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Ingredient Nutrients Modal */}
      <Modal
        visible={showIngredientModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowIngredientModal(false)}
      >
        <View style={styles.ingredientModalOverlay}>
          <View style={styles.ingredientModalContent}>
            <View style={styles.ingredientModalHeader}>
              <View style={styles.ingredientModalTitleRow}>
                <Icon name="food-apple" size={24} color={colors.primary} />
                <Text style={styles.ingredientModalTitle}>Ingredient Portions</Text>
              </View>
              <TouchableOpacity onPress={() => setShowIngredientModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.ingredientModalSubtitle}>
              Adjust portion for each ingredient. Changes will recalculate overall meal nutrients.
            </Text>

            <ScrollView style={styles.ingredientModalScroll} showsVerticalScrollIndicator={false}>
              {ingredientNutrients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientModalCard}>
                  <View style={styles.ingredientModalCardHeader}>
                    <View style={styles.ingredientTitleRow}>
                      <Icon name="food-variant" size={18} color="#27AE60" />
                      <Text style={styles.ingredientName}>{ingredient.ingredient}</Text>
                    </View>
                    {ingredient.serving_size && (
                      <Text style={styles.ingredientServing}>
                        {ingredient.serving_size}
                      </Text>
                    )}
                  </View>

                  <View style={styles.ingredientPortionControl}>
                    <Text style={styles.ingredientPortionLabel}>Portion:</Text>
                    <View style={styles.ingredientPortionAdjuster}>
                      <TouchableOpacity
                        style={styles.portionSmallButton}
                        onPress={() => {
                          const currentProportion = ingredientProportions[ingredient.ingredient] || 1.0;
                          const newProportion = Math.max(0, currentProportion - 0.25);
                          handleIngredientProportionChange(ingredient.ingredient, newProportion, true);
                        }}
                      >
                        <Icon name="minus" size={16} color="white" />
                      </TouchableOpacity>

                      <TextInput
                        style={styles.ingredientPortionInput}
                        value={(ingredientProportions[ingredient.ingredient] || 1.0).toFixed(2)}
                        onChangeText={(text) => {
                          handleIngredientProportionChange(ingredient.ingredient, text, false);
                        }}
                        onEndEditing={() => recalculateFromIngredients()}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.secondary}
                      />

                      <TouchableOpacity
                        style={styles.portionSmallButton}
                        onPress={() => {
                          const currentProportion = ingredientProportions[ingredient.ingredient] || 1.0;
                          const newProportion = currentProportion + 0.25;
                          handleIngredientProportionChange(ingredient.ingredient, newProportion, true);
                        }}
                      >
                        <Icon name="plus" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.ingredientPortionText}>x</Text>
                  </View>

                  <View style={styles.ingredientNutrientsGrid}>
                    {Object.entries(ingredient.nutrients).map(([key, value]) => (
                      <View key={key} style={styles.ingredientNutrientItem}>
                        <Text style={styles.ingredientNutrientLabel}>{key}</Text>
                        <Text style={styles.ingredientNutrientValue}>
                          {typeof value === 'number' ? value.toFixed(1) : value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.ingredientModalFooter}>
              <TouchableOpacity
                style={styles.ingredientModalCloseButton}
                onPress={() => setShowIngredientModal(false)}
              >
                <Text style={styles.ingredientModalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default MealDetailScreen;
