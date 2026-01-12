from datetime import datetime, timedelta
from bson import ObjectId
from config.database import get_db
from models.food_baseline_assessment import FoodBaselineAssessment
from models.user_meal import UserMeal
import logging

class FoodTrackingService:
    """
    Service for calculating prediabetes risk based on:
    1. Baseline food intake assessment
    2. Daily food logs and nutrient analysis
    """
    
    # Research-based thresholds for daily nutrient intake (per day)
    DAILY_THRESHOLDS = {
        'calories': {
            'optimal_min': 1800,
            'optimal_max': 2200,
            'risk_weight': 0.08
        },
        'carbs': {
            'optimal_max': 250,  # grams
            'high_risk': 350,
            'risk_weight': 0.12
        },
        'added_sugars': {
            'optimal_max': 25,  # grams (WHO recommendation)
            'high_risk': 50,
            'risk_weight': 0.15  # High impact on diabetes risk
        },
        'fiber': {
            'optimal_min': 25,  # grams
            'risk_weight': -0.10  # Protective factor
        },
        'saturated_fat': {
            'optimal_max': 20,  # grams
            'high_risk': 30,
            'risk_weight': 0.09
        },
        'sodium': {
            'optimal_max': 2300,  # mg
            'high_risk': 3400,
            'risk_weight': 0.06
        },
        'glycemic_load': {
            'optimal_max': 100,
            'high_risk': 150,
            'risk_weight': 0.13  # Strong predictor of diabetes risk
        },
        'protein': {
            'optimal_min': 50,  # grams
            'optimal_max': 175,
            'risk_weight': 0.03
        }
    }
    
    # Meal pattern analysis weights
    PATTERN_WEIGHTS = {
        'irregular_meal_times': 0.07,
        'meal_skipping': 0.08,
        'late_night_eating': 0.06,
        'meal_frequency': 0.05
    }
    
    @staticmethod
    def calculate_daily_log_risk(user_id, days=7):
        """
        Calculate risk score based on daily food logs over specified period
        
        Args:
            user_id: User ID
            days: Number of days to analyze (default 7)
            
        Returns:
            dict with daily_risk_score and analysis details
        """
        try:
            db = get_db()
            
            # Get meals from the last N days
            start_date = datetime.utcnow() - timedelta(days=days)
            end_date = datetime.utcnow()
            
            result = UserMeal.get_user_meals(
                user_id=user_id,
                limit=1000,  # Get all meals in period
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            )
            
            if not result['success'] or not result['meals']:
                return {
                    'success': True,
                    'daily_risk_score': 0,
                    'message': 'No meal data available for analysis',
                    'analysis': {}
                }
            
            meals = result['meals']
            
            # Calculate average daily nutrients
            daily_nutrients = FoodTrackingService._calculate_daily_averages(meals, days)
            
            # Calculate nutrient-based risk score
            nutrient_risk = FoodTrackingService._calculate_nutrient_risk(daily_nutrients)
            
            # Calculate meal pattern risk score
            pattern_risk = FoodTrackingService._calculate_pattern_risk(meals, days)
            
            # Combine scores (70% nutrient-based, 30% pattern-based)
            daily_risk_score = (nutrient_risk * 0.7) + (pattern_risk * 0.3)
            
            return {
                'success': True,
                'daily_risk_score': round(daily_risk_score, 2),
                'analysis': {
                    'nutrient_risk': round(nutrient_risk, 2),
                    'pattern_risk': round(pattern_risk, 2),
                    'daily_averages': daily_nutrients,
                    'days_analyzed': days,
                    'total_meals': len(meals)
                }
            }
            
        except Exception as e:
            logging.error(f"Error calculating daily log risk for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def _calculate_daily_averages(meals, days):
        """Calculate average daily nutrient intake"""
        totals = {
            'calories': 0,
            'protein': 0,
            'carbs': 0,
            'fat': 0,
            'added_sugars': 0,
            'fiber': 0,
            'saturated_fat': 0,
            'unsaturated_fat': 0,
            'sodium': 0,
            'glycemic_load': 0
        }
        
        for meal in meals:
            nutrients = meal.get('nutrients', {})
            totals['calories'] += nutrients.get('Calories', 0)
            totals['protein'] += nutrients.get('Protein (g)', 0)
            totals['carbs'] += nutrients.get('Carbs (g)', 0)
            totals['fat'] += nutrients.get('Fat (g)', 0)
            totals['added_sugars'] += nutrients.get('Added Sugars (g)', 0)
            totals['fiber'] += nutrients.get('Fiber (g)', 0)
            totals['saturated_fat'] += nutrients.get('Saturated Fat (g)', 0)
            totals['unsaturated_fat'] += nutrients.get('Unsaturated Fat (g)', 0)
            totals['sodium'] += nutrients.get('Sodium (mg)', 0)
            totals['glycemic_load'] += nutrients.get('Glycemic Load', 0)
        
        # Calculate averages
        averages = {}
        for key, value in totals.items():
            averages[key] = round(value / days, 2) if days > 0 else 0
        
        return averages
    
    @staticmethod
    def _calculate_nutrient_risk(daily_nutrients):
        """Calculate risk score based on nutrient intake"""
        total_risk = 0
        max_possible_risk = 0
        
        for nutrient, thresholds in FoodTrackingService.DAILY_THRESHOLDS.items():
            value = daily_nutrients.get(nutrient, 0)
            weight = thresholds['risk_weight']
            risk_score = 0
            
            # For nutrients with optimal range
            if 'optimal_min' in thresholds and 'optimal_max' in thresholds:
                optimal_min = thresholds['optimal_min']
                optimal_max = thresholds['optimal_max']
                
                if value < optimal_min:
                    # Below optimal
                    deviation = (optimal_min - value) / optimal_min
                    risk_score = deviation * abs(weight) * 100
                elif value > optimal_max:
                    # Above optimal
                    deviation = (value - optimal_max) / optimal_max
                    risk_score = min(deviation * abs(weight) * 100, abs(weight) * 100)
                else:
                    # Within optimal range
                    risk_score = 0
                    
            # For nutrients with only optimal minimum (protective factors)
            elif 'optimal_min' in thresholds:
                optimal_min = thresholds['optimal_min']
                
                if value >= optimal_min:
                    # Meeting optimal intake (protective)
                    risk_score = 0
                else:
                    # Below optimal (less protection)
                    shortfall = (optimal_min - value) / optimal_min
                    risk_score = shortfall * abs(weight) * 100
                    
            # For nutrients with only optimal maximum (risk factors)
            elif 'optimal_max' in thresholds:
                optimal_max = thresholds['optimal_max']
                high_risk = thresholds.get('high_risk', optimal_max * 1.5)
                
                if value <= optimal_max:
                    # Within safe range
                    risk_score = 0
                elif value <= high_risk:
                    # Moderate excess
                    excess = (value - optimal_max) / (high_risk - optimal_max)
                    risk_score = excess * abs(weight) * 100
                else:
                    # High excess
                    risk_score = abs(weight) * 100
            
            total_risk += risk_score
            max_possible_risk += abs(weight) * 100
        
        # Calculate percentage risk
        if max_possible_risk > 0:
            nutrient_risk = (total_risk / max_possible_risk) * 100
        else:
            nutrient_risk = 0
        
        return max(0, min(100, nutrient_risk))
    
    @staticmethod
    def _calculate_pattern_risk(meals, days):
        """Calculate risk based on meal patterns"""
        if not meals:
            return 50  # Moderate risk if no data
        
        total_risk = 0
        max_possible_risk = 0
        
        # Analyze meal timing patterns
        meal_times_by_day = {}
        
        for meal in meals:
            meal_datetime = meal.get('meal_datetime')
            if isinstance(meal_datetime, str):
                meal_datetime = datetime.fromisoformat(meal_datetime.replace('Z', '+00:00'))
            
            day_key = meal_datetime.date()
            if day_key not in meal_times_by_day:
                meal_times_by_day[day_key] = []
            
            meal_times_by_day[day_key].append(meal_datetime.hour)
        
        # 1. Meal frequency analysis
        days_with_meals = len(meal_times_by_day)
        if days_with_meals > 0:
            avg_meals_per_day = len(meals) / days_with_meals
            
            # Optimal: 3-4 meals per day
            if avg_meals_per_day < 2:
                frequency_risk = 0.8 * FoodTrackingService.PATTERN_WEIGHTS['meal_frequency'] * 100
            elif avg_meals_per_day > 6:
                frequency_risk = 0.6 * FoodTrackingService.PATTERN_WEIGHTS['meal_frequency'] * 100
            else:
                frequency_risk = 0
            
            total_risk += frequency_risk
            max_possible_risk += FoodTrackingService.PATTERN_WEIGHTS['meal_frequency'] * 100
        
        # 2. Late night eating analysis (eating after 8 PM)
        late_night_count = 0
        for meal in meals:
            meal_datetime = meal.get('meal_datetime')
            if isinstance(meal_datetime, str):
                meal_datetime = datetime.fromisoformat(meal_datetime.replace('Z', '+00:00'))
            
            if meal_datetime.hour >= 20:  # 8 PM or later
                late_night_count += 1
        
        if len(meals) > 0:
            late_night_ratio = late_night_count / len(meals)
            late_night_risk = late_night_ratio * FoodTrackingService.PATTERN_WEIGHTS['late_night_eating'] * 100
            
            total_risk += late_night_risk
            max_possible_risk += FoodTrackingService.PATTERN_WEIGHTS['late_night_eating'] * 100
        
        # 3. Irregular meal times analysis
        irregularity_scores = []
        for day, times in meal_times_by_day.items():
            if len(times) >= 2:
                times_sorted = sorted(times)
                # Check if meal times vary significantly
                time_variance = max(times_sorted) - min(times_sorted)
                if time_variance > 14:  # More than 14 hours between first and last meal
                    irregularity_scores.append(1)
                else:
                    irregularity_scores.append(0)
        
        if irregularity_scores:
            irregularity_ratio = sum(irregularity_scores) / len(irregularity_scores)
            irregularity_risk = irregularity_ratio * FoodTrackingService.PATTERN_WEIGHTS['irregular_meal_times'] * 100
            
            total_risk += irregularity_risk
            max_possible_risk += FoodTrackingService.PATTERN_WEIGHTS['irregular_meal_times'] * 100
        
        # Calculate percentage risk
        if max_possible_risk > 0:
            pattern_risk = (total_risk / max_possible_risk) * 100
        else:
            pattern_risk = 0
        
        return max(0, min(100, pattern_risk))
    
    @staticmethod
    def calculate_comprehensive_risk(user_id, days=7):
        """
        Calculate comprehensive prediabetes risk score combining:
        1. Baseline assessment (40% weight)
        2. Daily log analysis (60% weight)
        
        Returns risk score from 0-100 with risk category
        """
        try:
            # Get baseline risk
            baseline_result = FoodBaselineAssessment.get_user_baseline(user_id)
            
            baseline_risk = 0
            if baseline_result['success'] and baseline_result.get('baseline'):
                baseline_risk = baseline_result['baseline'].get('baseline_risk_score', 0)
                
                # If baseline risk is 0, recalculate it
                if baseline_risk == 0 and baseline_result['baseline'].get('responses'):
                    update_result = FoodBaselineAssessment.update_baseline_risk_score(user_id)
                    if update_result['success']:
                        baseline_risk = update_result['baseline_risk_score']
            
            # Get daily log risk
            daily_log_result = FoodTrackingService.calculate_daily_log_risk(user_id, days)
            
            daily_log_risk = 0
            daily_analysis = {}
            if daily_log_result['success']:
                daily_log_risk = daily_log_result.get('daily_risk_score', 0)
                daily_analysis = daily_log_result.get('analysis', {})
            
            # Calculate comprehensive risk (40% baseline, 60% daily logs)
            # Daily logs weighted more heavily as they reflect current behavior
            comprehensive_risk = (baseline_risk * 0.4) + (daily_log_risk * 0.6)
            
            # Determine risk category
            if comprehensive_risk < 25:
                risk_category = 'Low'
                risk_message = 'Your eating habits show low risk for prediabetes. Keep maintaining healthy choices!'
            elif comprehensive_risk < 50:
                risk_category = 'Moderate'
                risk_message = 'Your eating habits show moderate risk. Consider improving your diet to reduce risk.'
            elif comprehensive_risk < 75:
                risk_category = 'High'
                risk_message = 'Your eating habits show high risk for prediabetes. Dietary changes are recommended.'
            else:
                risk_category = 'Very High'
                risk_message = 'Your eating habits show very high risk. Please consult a healthcare provider and make significant dietary changes.'
            
            return {
                'success': True,
                'comprehensive_risk_score': round(comprehensive_risk, 2),
                'risk_category': risk_category,
                'risk_message': risk_message,
                'breakdown': {
                    'baseline_risk': round(baseline_risk, 2),
                    'daily_log_risk': round(daily_log_risk, 2),
                    'daily_analysis': daily_analysis
                }
            }
            
        except Exception as e:
            logging.error(f"Error calculating comprehensive risk for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def get_personalized_recommendations(user_id):
        """
        Generate personalized recommendations based on risk assessment
        """
        try:
            # Get comprehensive risk assessment
            risk_result = FoodTrackingService.calculate_comprehensive_risk(user_id)
            
            if not risk_result['success']:
                return risk_result
            
            recommendations = []
            daily_analysis = risk_result.get('breakdown', {}).get('daily_analysis', {})
            daily_averages = daily_analysis.get('daily_averages', {})
            
            # Analyze each nutrient and provide specific recommendations
            if daily_averages.get('added_sugars', 0) > FoodTrackingService.DAILY_THRESHOLDS['added_sugars']['optimal_max']:
                recommendations.append({
                    'category': 'Added Sugars',
                    'priority': 'High',
                    'message': f"Your daily added sugar intake ({daily_averages.get('added_sugars', 0):.1f}g) exceeds the recommended 25g. Reduce sugary drinks and processed foods."
                })
            
            if daily_averages.get('fiber', 0) < FoodTrackingService.DAILY_THRESHOLDS['fiber']['optimal_min']:
                recommendations.append({
                    'category': 'Fiber',
                    'priority': 'High',
                    'message': f"Your daily fiber intake ({daily_averages.get('fiber', 0):.1f}g) is below the recommended 25g. Increase whole grains, vegetables, and legumes."
                })
            
            if daily_averages.get('glycemic_load', 0) > FoodTrackingService.DAILY_THRESHOLDS['glycemic_load']['optimal_max']:
                recommendations.append({
                    'category': 'Glycemic Load',
                    'priority': 'High',
                    'message': 'Your meals have high glycemic load. Choose low-GI foods like whole grains, legumes, and non-starchy vegetables.'
                })
            
            if daily_averages.get('saturated_fat', 0) > FoodTrackingService.DAILY_THRESHOLDS['saturated_fat']['optimal_max']:
                recommendations.append({
                    'category': 'Saturated Fat',
                    'priority': 'Medium',
                    'message': 'Reduce saturated fat intake by choosing lean proteins and limiting fried foods.'
                })
            
            # Get baseline assessment for additional recommendations
            baseline_result = FoodBaselineAssessment.get_user_baseline(user_id)
            if baseline_result['success'] and baseline_result.get('baseline'):
                responses = baseline_result['baseline'].get('responses', {})
                
                if responses.get('skip_breakfast') in ['Often (5-6 times/week)', 'Always (daily)']:
                    recommendations.append({
                        'category': 'Meal Timing',
                        'priority': 'High',
                        'message': 'Skipping breakfast regularly increases diabetes risk. Try to eat a balanced breakfast daily.'
                    })
                
                if responses.get('sugary_drinks_frequency') in ['Often (5-6 times/week)', 'Daily']:
                    recommendations.append({
                        'category': 'Beverages',
                        'priority': 'High',
                        'message': 'Frequent sugary drink consumption significantly increases diabetes risk. Switch to water or unsweetened beverages.'
                    })
            
            return {
                'success': True,
                'risk_assessment': risk_result,
                'recommendations': recommendations
            }
            
        except Exception as e:
            logging.error(f"Error generating recommendations for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
