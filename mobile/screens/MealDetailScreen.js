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
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });

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
      const response = await api.updateMeal(
        meal.id,
        editedMealName.trim(),
        editedNotes.trim()
      );

      if (response.success) {
        setMeal(prev => ({
          ...prev,
          meal_name: editedMealName.trim(),
          notes: editedNotes.trim()
        }));
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
    setIsEditing(false);
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
            <View style={[
              styles.foodTypeIcon,
              { backgroundColor: `${foodTypeInfo.color}15` }
            ]}>
              <Icon name={foodTypeInfo.icon} size={20} color={foodTypeInfo.color} />
            </View>
            <Text style={styles.foodTypeText}>{foodTypeInfo.label}</Text>
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

        {/* Nutrients Section */}
        {meal.nutrients && Object.keys(meal.nutrients).length > 0 && (
          <View style={styles.nutrientsSection}>
            <Text style={styles.sectionTitle}>Nutritional Information</Text>
            <View style={styles.nutrientsGrid}>
              {Object.entries(meal.nutrients).map(([key, value]) => {
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
