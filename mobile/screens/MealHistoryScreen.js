import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../services/api';

const MealHistoryScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const toast = useToast();

  const [meals, setMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [overallNutrients, setOverallNutrients] = useState({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0
  });

  // Time period options
  const timePeriods = [
    { label: 'Today', value: 'today' },
    { label: '7 Days', value: '7days' },
    { label: '1 Month', value: '1month' },
    { label: '3 Months', value: '3months' },
  ];

  // Get date range for selected period
  const getDateRange = (period) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      case '7days':
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          start: sevenDaysAgo.toISOString(),
          end: now.toISOString()
        };
      case '1month':
        const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          start: oneMonthAgo.toISOString(),
          end: now.toISOString()
        };
      case '3months':
        const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        return {
          start: threeMonthsAgo.toISOString(),
          end: now.toISOString()
        };
      default:
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
    }
  };

  // Calculate overall nutrients from meals
  const calculateOverallNutrients = (mealsData) => {
    console.log('Calculating overall nutrients for meals:', mealsData.length);
    
    const totals = {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0
    };

    mealsData.forEach((meal, index) => {
      console.log(`Meal ${index + 1} nutrients:`, meal.nutrients);
      if (meal.nutrients) {
        // Use flexible key mapping to handle different nutrient key formats
        totals.calories += parseFloat(meal.nutrients.calories || meal.nutrients.Calories || 0);
        totals.protein += parseFloat(meal.nutrients.protein || meal.nutrients['Protein (g)'] || 0);
        totals.carbohydrates += parseFloat(meal.nutrients.carbohydrates || meal.nutrients.carbs || meal.nutrients['Carbs (g)'] || 0);
        totals.fat += parseFloat(meal.nutrients.fat || meal.nutrients['Fat (g)'] || 0);
      }
    });

    console.log('Calculated totals:', totals);
    return totals;
  };

  // Food type icons and colors
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

  // Get nutrient icon and color for main nutrients
  const getNutrientIcon = (nutrientKey) => {
    const nutrientMap = {
      'calories': { icon: 'fire', color: '#E74C3C' },
      'protein': { icon: 'dumbbell', color: '#E67E22' },
      'carbohydrates': { icon: 'grain', color: '#F39C12' },
      'carbs': { icon: 'grain', color: '#F39C12' },
      'fat': { icon: 'water-outline', color: '#9B59B6' },
    };
    return nutrientMap[nutrientKey] || { icon: 'nutrition', color: '#3498DB' };
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Format time for display
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get main nutrients summary with icons
  const getNutrientSummary = (nutrients) => {
    console.log('getNutrientSummary called with:', nutrients);
    
    if (!nutrients || typeof nutrients !== 'object') {
      console.log('No nutrients or invalid nutrients object');
      return [];
    }
    
    // Map backend keys to display keys
    const keyMapping = {
      'calories': ['Calories', 'calories'],
      'protein': ['Protein (g)', 'protein'],
      'carbohydrates': ['Carbs (g)', 'carbohydrates', 'carbs'],
      'fat': ['Fat (g)', 'fat']
    };
    
    const mainNutrients = ['calories', 'protein', 'carbohydrates', 'fat'];
    const result = mainNutrients
      .map(key => {
        // Try different possible keys for this nutrient
        let value = null;
        const possibleKeys = keyMapping[key];
        
        for (const possibleKey of possibleKeys) {
          if (nutrients[possibleKey] !== undefined && nutrients[possibleKey] !== null) {
            value = nutrients[possibleKey];
            break;
          }
        }
        
        if (value === undefined || value === null) {
          return null;
        }
        
        const nutrientInfo = getNutrientIcon(key);
        return {
          name: key,
          value: typeof value === 'number' ? value.toFixed(1) : String(value),
          unit: key === 'calories' ? 'kcal' : 'g',
          icon: nutrientInfo.icon,
          color: nutrientInfo.color
        };
      })
      .filter(item => item !== null); // Remove null entries
    
    console.log('Processed nutrients:', result);
    return result;
  };

  // Load meals from API
  const loadMeals = async (offset = 0, refresh = false, period = selectedPeriod) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else if (offset === 0) {
        setIsLoading(true);
      }

      const dateRange = getDateRange(period);
      const response = await api.getUserMeals(50, offset, dateRange.start, dateRange.end);
      
      console.log('API response:', response);
      
      if (response.success) {
        const newMeals = response.data.meals;
        console.log('Raw meals from API:', newMeals);
        
        // Log first meal's nutrients structure for debugging
        if (newMeals.length > 0) {
          console.log('First meal nutrients structure:', newMeals[0].nutrients);
          console.log('First meal keys:', Object.keys(newMeals[0].nutrients || {}));
        }
        
        if (refresh || offset === 0) {
          setMeals(newMeals);
          setCurrentOffset(newMeals.length);
          
          // Calculate overall nutrients for the period
          const nutrients = calculateOverallNutrients(newMeals);
          setOverallNutrients(nutrients);
        } else {
          setMeals(prev => [...prev, ...newMeals]);
          setCurrentOffset(prev => prev + newMeals.length);
        }
        
        setHasMore(newMeals.length === 50);
      } else {
        toast.error(response.error || 'Failed to load meals');
      }
    } catch (error) {
      console.error('Error loading meals:', error);
      toast.error('Failed to load meals. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadMeals();
  }, []);

  // Handle period change
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    setCurrentOffset(0);
    setHasMore(true);
    loadMeals(0, false, period);
  };

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadMeals(0, true, selectedPeriod);
  }, [selectedPeriod]);

  // Handle load more
  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadMeals(currentOffset);
    }
  };

  // Navigate to meal detail
  const handleMealPress = (meal) => {
    navigation.navigate('MealDetail', { meal });
  };

  // Handle meal deletion
  const handleDeleteMeal = async (mealId) => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.deleteMeal(mealId);
              if (response.success) {
                setMeals(prev => prev.filter(meal => meal.id !== mealId));
                toast.success('Meal deleted successfully');
              } else {
                toast.error(response.error || 'Failed to delete meal');
              }
            } catch (error) {
              console.error('Error deleting meal:', error);
              toast.error('Failed to delete meal');
            }
          }
        }
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      padding: 8,
      marginRight: 12,
      borderRadius: 8,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.secondary,
    },
    // Overall nutrients summary styles
    overallNutrientsContainer: {
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    overallNutrientsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    overallNutrientsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      backgroundColor: colors.card,
    },
    overallNutrientItem: {
      alignItems: 'center',
      flex: 1,
    },
    overallNutrientIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    overallNutrientValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    overallNutrientLabel: {
      fontSize: 9,
      color: colors.secondary,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    // Time period filter styles
    periodFilterContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginHorizontal: 2,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 0,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.secondary,
      textAlign: 'center',
    },
    periodButtonTextActive: {
      color: 'white',
    },
    content: {
      flex: 1,
    },
    mealCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 6,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    },
    mealHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    mealImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
    },
    mealImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    mealInfo: {
      flex: 1,
    },
    mealName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    mealDateTime: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    dateTimeText: {
      fontSize: 12,
      color: colors.secondary,
      marginLeft: 6,
    },
    foodTypeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    foodTypeIcon: {
      marginRight: 6,
    },
    foodTypeText: {
      fontSize: 12,
      color: colors.secondary,
      textTransform: 'capitalize',
    },
    mealActions: {
      justifyContent: 'center',
    },
    actionButton: {
      padding: 8,
      borderRadius: 20,
      marginVertical: 2,
    },
    nutrientsSummary: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexWrap: 'nowrap',
    },
    nutrientItem: {
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 2,
    },
    nutrientIconContainer: {
      width: 16,
      height: 16,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    nutrientValue: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.text,
    },
    nutrientLabel: {
      fontSize: 7,
      color: colors.secondary,
      marginTop: 1,
      textTransform: 'capitalize',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.secondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 16,
      color: colors.secondary,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 22,
    },
    loadMoreContainer: {
      padding: 20,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: 16,
      color: colors.secondary,
    },
  });

  if (isLoading && meals.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={28} color="red" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Meal History</Text>
            <Text style={styles.headerSubtitle}>Your food tracking journey</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your meals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={28} color="red" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Meal History</Text>
          <Text style={styles.headerSubtitle}>
            {meals.length} meal{meals.length !== 1 ? 's' : ''} tracked
          </Text>
        </View>
      </View>

      {/* Overall Nutrients Summary */}
      <View style={styles.overallNutrientsContainer}>
        <Text style={styles.overallNutrientsTitle}>
          {timePeriods.find(p => p.value === selectedPeriod)?.label} Summary
        </Text>
        
        <View style={styles.overallNutrientsGrid}>
          {['calories', 'protein', 'carbohydrates', 'fat'].map((nutrient) => {
            const nutrientInfo = getNutrientIcon(nutrient);
            const value = overallNutrients[nutrient] || 0;
            const unit = nutrient === 'calories' ? 'kcal' : 'g';
            
            return (
              <View key={nutrient} style={styles.overallNutrientItem}>
                <View style={[
                  styles.overallNutrientIconContainer,
                  { backgroundColor: `${nutrientInfo.color}15` }
                ]}>
                  <Icon name={nutrientInfo.icon} size={16} color={nutrientInfo.color} />
                </View>
                <Text style={styles.overallNutrientValue}>
                  {value.toFixed(1)}{unit}
                </Text>
                <Text style={styles.overallNutrientLabel}>{nutrient}</Text>
              </View>
            );
          })}
        </View>

        {/* Time Period Filter */}
        <View style={styles.periodFilterContainer}>
          {timePeriods.map((period) => (
            <TouchableOpacity
              key={period.value}
              style={[
                styles.periodButton,
                selectedPeriod === period.value && styles.periodButtonActive
              ]}
              onPress={() => handlePeriodChange(period.value)}
              disabled={isLoading}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === period.value && styles.periodButtonTextActive
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onMomentumScrollEnd={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const isCloseToBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
          if (isCloseToBottom && hasMore && !isLoading) {
            handleLoadMore();
          }
        }}
      >
        {meals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="food-off" size={64} color={colors.secondary} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No meals yet</Text>
            <Text style={styles.emptySubtitle}>
              Start tracking your nutrition by scanning your first meal in the Measure tab!
            </Text>
          </View>
        ) : (
          meals.map((meal) => {
            console.log('Rendering meal:', meal.id, 'nutrients:', meal.nutrients);
            const foodTypeInfo = getFoodTypeInfo(meal.food_type);
            const nutrients = getNutrientSummary(meal.nutrients);
            console.log('Processed nutrients for meal', meal.id, ':', nutrients);
            
            return (
              <TouchableOpacity
                key={meal.id}
                style={styles.mealCard}
                onPress={() => handleMealPress(meal)}
                activeOpacity={0.7}
              >
                <View style={styles.mealHeader}>
                  {meal.image_url ? (
                    <Image source={{ uri: meal.image_url }} style={styles.mealImage} />
                  ) : (
                    <View style={styles.mealImagePlaceholder}>
                      <Icon name="image-off" size={24} color={colors.secondary} />
                    </View>
                  )}
                  
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName} numberOfLines={1}>
                      {meal.meal_name}
                    </Text>
                    
                    <View style={styles.mealDateTime}>
                      <Icon name="clock-outline" size={14} color={colors.secondary} />
                      <Text style={styles.dateTimeText}>
                        {formatDate(meal.created_at)} • {formatTime(meal.created_at)}
                      </Text>
                    </View>
                    
                    <View style={styles.foodTypeContainer}>
                      <Icon 
                        name={foodTypeInfo.icon} 
                        size={14} 
                        color={foodTypeInfo.color} 
                        style={styles.foodTypeIcon}
                      />
                      <Text style={styles.foodTypeText}>{foodTypeInfo.label}</Text>
                    </View>
                  </View>

                  <View style={styles.mealActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: `${colors.primary}15` }]}
                      onPress={() => handleMealPress(meal)}
                    >
                      <Icon name="eye" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: `#E74C3C15` }]}
                      onPress={() => handleDeleteMeal(meal.id)}
                    >
                      <Icon name="delete" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                </View>

                {nutrients.length > 0 && (
                  <View style={styles.nutrientsSummary}>
                    {nutrients.map((nutrient, index) => (
                      <View key={index} style={styles.nutrientItem}>
                        <View style={[
                          styles.nutrientIconContainer,
                          { backgroundColor: `${nutrient.color}15` }
                        ]}>
                          <Icon name={nutrient.icon} size={8} color={nutrient.color} />
                        </View>
                        <Text style={styles.nutrientValue}>
                          {nutrient.value}{nutrient.unit}
                        </Text>
                        <Text style={styles.nutrientLabel}>{nutrient.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {isLoading && meals.length > 0 && (
          <View style={styles.loadMoreContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadMoreText}>Loading more meals...</Text>
          </View>
        )}

        {!hasMore && meals.length > 0 && (
          <View style={styles.loadMoreContainer}>
            <Text style={styles.loadMoreText}>No more meals to load</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MealHistoryScreen;
