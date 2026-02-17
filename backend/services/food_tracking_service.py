from datetime import datetime, timedelta
from bson import ObjectId
from config.database import get_db
from models.food_baseline_assessment import FoodBaselineAssessment
from models.user_meal import UserMeal
import logging
import pytz

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
    def evaluate_nutrient_status(nutrient_key, value, threshold_data):
        """
        Evaluate the status of a nutrient based on its value and thresholds
        
        Args:
            nutrient_key: The nutrient key (e.g., 'calories', 'fiber')
            value: The nutrient value
            threshold_data: The threshold configuration for this nutrient
            
        Returns:
            status string: 'optimal', 'low', 'moderate', or 'high'
        """
        if 'optimal_min' in threshold_data and 'optimal_max' in threshold_data:
            if value < threshold_data['optimal_min']:
                return 'low'
            elif value > threshold_data['optimal_max']:
                return 'high'
            else:
                return 'optimal'
        elif 'optimal_min' in threshold_data:
            return 'optimal' if value >= threshold_data['optimal_min'] else 'low'
        elif 'optimal_max' in threshold_data:
            high_risk = threshold_data.get('high_risk', threshold_data['optimal_max'] * 1.5)
            if value <= threshold_data['optimal_max']:
                return 'optimal'
            elif value <= high_risk:
                return 'moderate'
            else:
                return 'high'
        else:
            return 'unknown'
    
    @staticmethod
    def get_today_totals(user_id, timezone='Asia/Manila'):
        """
        Get today's meal totals based on user's timezone
        
        Args:
            user_id: User ID
            timezone: Timezone string (default: 'Asia/Manila' for Philippines)
            
        Returns:
            dict with today's nutrient totals
        """
        try:
            # Get timezone-aware datetime for today
            tz = pytz.timezone(timezone)
            now = datetime.now(tz)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            # Convert to UTC for database query
            start_date_utc = today_start.astimezone(pytz.UTC)
            end_date_utc = today_end.astimezone(pytz.UTC)
            
            # Get today's meals
            result = UserMeal.get_user_meals(
                user_id=user_id,
                limit=1000,
                start_date=start_date_utc.isoformat(),
                end_date=end_date_utc.isoformat()
            )
            
            if not result['success'] or not result['meals']:
                return {
                    'success': True,
                    'totals': {},
                    'meal_count': 0,
                    'has_data': False
                }
            
            meals = result['meals']
            
            # Calculate totals for today
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
            
            # Round all values
            for key in totals:
                totals[key] = round(totals[key], 2)
            
            return {
                'success': True,
                'totals': totals,
                'meal_count': len(meals),
                'has_data': True,
                'date': today_start.strftime('%Y-%m-%d'),
                'timezone': timezone
            }
            
        except Exception as e:
            logging.error(f"Error getting today's totals for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
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
            
            # Get meals from the last N days using Philippine timezone
            tz = pytz.timezone('Asia/Manila')
            now = datetime.now(tz)
            start_date = now - timedelta(days=days)
            
            # Convert to UTC for database query
            start_date_utc = start_date.astimezone(pytz.UTC)
            end_date_utc = now.astimezone(pytz.UTC)
            
            result = UserMeal.get_user_meals(
                user_id=user_id,
                limit=1000,  # Get all meals in period
                start_date=start_date_utc.isoformat(),
                end_date=end_date_utc.isoformat()
            )
            
            if not result['success'] or not result['meals']:
                # When no meals logged, return None to indicate no data
                # The comprehensive risk calculation will use baseline risk instead
                return {
                    'success': True,
                    'daily_risk_score': None,
                    'message': 'No meal data available for analysis',
                    'analysis': {},
                    'has_data': False
                }
            
            meals = result['meals']
            
            # Check data sufficiency
            # Expected: minimum 2 meals per day for reliable assessment
            expected_min_meals = days * 2
            actual_meals = len(meals)
            meals_per_day = actual_meals / days if days > 0 else 0
            
            # If insufficient data (less than 2 meals/day average), flag as unreliable
            data_sufficient = actual_meals >= expected_min_meals
            data_quality = 'good' if meals_per_day >= 2.5 else 'partial' if meals_per_day >= 1.5 else 'insufficient'
            
            # Calculate average daily nutrients
            daily_nutrients = FoodTrackingService._calculate_daily_averages(meals, days)
            
            # Calculate nutrient-based risk score
            nutrient_risk = FoodTrackingService._calculate_nutrient_risk(daily_nutrients)
            
            # Calculate meal pattern risk score
            pattern_risk = FoodTrackingService._calculate_pattern_risk(meals, days)
            
            # Combine scores (70% nutrient-based, 30% pattern-based)
            daily_risk_score = (nutrient_risk * 0.7) + (pattern_risk * 0.3)
            
            # Warning message for insufficient data
            warning_message = None
            if not data_sufficient:
                warning_message = f"Only {actual_meals} meals logged over {days} days (avg {meals_per_day:.1f}/day). Assessment may be inaccurate. Log at least 2 meals daily for reliable results."
            
            return {
                'success': True,
                'daily_risk_score': round(daily_risk_score, 2),
                'analysis': {
                    'nutrient_risk': round(nutrient_risk, 2),
                    'pattern_risk': round(pattern_risk, 2),
                    'daily_averages': daily_nutrients,
                    'days_analyzed': days,
                    'total_meals': actual_meals,
                    'meals_per_day': round(meals_per_day, 2),
                    'expected_min_meals': expected_min_meals,
                    'data_sufficient': data_sufficient,
                    'data_quality': data_quality
                },
                'has_data': True,
                'warning': warning_message
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
            return 0  # No pattern risk if no data (will be handled by comprehensive calculation)
        
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
            has_meal_data = False
            data_warning = None
            
            if daily_log_result['success']:
                has_meal_data = daily_log_result.get('has_data', False)
                daily_analysis = daily_log_result.get('analysis', {})
                data_warning = daily_log_result.get('warning')
                
                # If no meal data, use baseline risk for daily log component
                # This ensures users aren't rewarded for not logging meals
                if not has_meal_data or daily_log_result.get('daily_risk_score') is None:
                    daily_log_risk = baseline_risk
                else:
                    daily_log_risk = daily_log_result.get('daily_risk_score', baseline_risk)
            
            # Calculate comprehensive risk (40% baseline, 60% daily logs)
            # Daily logs weighted more heavily as they reflect current behavior
            # When no meals logged, daily_log_risk defaults to baseline_risk,
            # making comprehensive_risk equal to baseline_risk
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
            
            result = {
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
            
            # Add warning if data quality is insufficient
            if data_warning:
                result['warning'] = data_warning
                result['data_quality'] = daily_analysis.get('data_quality', 'unknown')
            
            return result
            
        except Exception as e:
            logging.error(f"Error calculating comprehensive risk for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def get_personalized_recommendations(user_id):
        """
        Generate comprehensive personalized recommendations based on risk assessment
        """
        try:
            # Get comprehensive risk assessment
            risk_result = FoodTrackingService.calculate_comprehensive_risk(user_id)
            
            if not risk_result['success']:
                return risk_result
            
            recommendations = []
            daily_analysis = risk_result.get('breakdown', {}).get('daily_analysis', {})
            daily_averages = daily_analysis.get('daily_averages', {})
            
            # Check for insufficient data first - highest priority
            data_quality = risk_result.get('data_quality', 'good')
            if data_quality in ['insufficient', 'partial']:
                meals_per_day = daily_analysis.get('meals_per_day', 0)
                total_meals = daily_analysis.get('total_meals', 0)
                
                if data_quality == 'insufficient':
                    recommendations.insert(0, {
                        'category': 'Data Quality',
                        'priority': 'Critical',
                        'message': f'Only {total_meals} meals logged (avg {meals_per_day:.1f}/day). Your risk assessment may be INACCURATE. Log at least 2-3 meals daily for reliable results.',
                        'actionable_tips': [
                            'Use the food scanner to quickly log meals',
                            'Set reminders to log breakfast, lunch, and dinner',
                            'Log meals immediately after eating for accuracy'
                        ]
                    })
                else:  # partial
                    recommendations.insert(0, {
                        'category': 'Data Quality',
                        'priority': 'High',
                        'message': f'Logging {meals_per_day:.1f} meals/day. For more accurate assessment, log all meals (aim for 3+ daily).',
                        'actionable_tips': [
                            'Try to log snacks and beverages too',
                            'Consistency helps us provide better insights'
                        ]
                    })
            
            # 1. ADDED SUGARS - Critical for diabetes risk
            if daily_averages.get('added_sugars', 0) > FoodTrackingService.DAILY_THRESHOLDS['added_sugars']['optimal_max']:
                sugar_amt = daily_averages.get('added_sugars', 0)
                excess = sugar_amt - 25
                recommendations.append({
                    'category': 'Added Sugars',
                    'priority': 'High',
                    'message': f"Your daily added sugar intake ({sugar_amt:.1f}g) exceeds the recommended 25g by {excess:.1f}g. This significantly increases prediabetes risk.",
                    'actionable_tips': [
                        'Replace sugary drinks with water, unsweetened tea, or sparkling water',
                        'Choose fresh fruit instead of fruit juice or dried fruit',
                        'Read food labels - avoid items with >5g added sugar per serving',
                        'Use cinnamon or vanilla extract for sweetness instead of sugar'
                    ]
                })
            
            # 2. FIBER - Protective factor
            if daily_averages.get('fiber', 0) < FoodTrackingService.DAILY_THRESHOLDS['fiber']['optimal_min']:
                fiber_amt = daily_averages.get('fiber', 0)
                deficit = 25 - fiber_amt
                recommendations.append({
                    'category': 'Fiber',
                    'priority': 'High',
                    'message': f"Your daily fiber intake ({fiber_amt:.1f}g) is {deficit:.1f}g below the recommended 25g. Fiber helps control blood sugar and reduces diabetes risk.",
                    'actionable_tips': [
                        'Add beans or lentils to meals (15g fiber per cup)',
                        'Choose whole grain bread, pasta, and rice over refined versions',
                        'Eat vegetables at every meal - aim for 5 servings daily',
                        'Snack on nuts, seeds, or fresh fruit with skin',
                        'Start meals with a salad to boost fiber intake'
                    ]
                })
            
            # 3. GLYCEMIC LOAD - Blood sugar impact
            if daily_averages.get('glycemic_load', 0) > FoodTrackingService.DAILY_THRESHOLDS['glycemic_load']['optimal_max']:
                gl_amt = daily_averages.get('glycemic_load', 0)
                recommendations.append({
                    'category': 'Glycemic Control',
                    'priority': 'High',
                    'message': f'Your average glycemic load ({gl_amt:.0f}) is high, causing blood sugar spikes. Aim for under 100 daily.',
                    'actionable_tips': [
                        'Pair carbs with protein or healthy fats (e.g., apple with peanut butter)',
                        'Choose whole grains: quinoa, brown rice, steel-cut oats',
                        'Add vinegar to meals - helps reduce glycemic response',
                        'Eat non-starchy vegetables first, then protein, then carbs',
                        'Limit white bread, white rice, and potatoes'
                    ]
                })
            
            # 4. SATURATED FAT
            if daily_averages.get('saturated_fat', 0) > FoodTrackingService.DAILY_THRESHOLDS['saturated_fat']['optimal_max']:
                sat_fat = daily_averages.get('saturated_fat', 0)
                recommendations.append({
                    'category': 'Saturated Fat',
                    'priority': 'Medium',
                    'message': f'Your saturated fat intake ({sat_fat:.1f}g) exceeds 20g. High saturated fat impairs insulin sensitivity.',
                    'actionable_tips': [
                        'Choose lean proteins: chicken breast, fish, turkey, tofu',
                        'Limit red meat to 1-2 times per week',
                        'Use olive oil or avocado oil instead of butter',
                        'Remove skin from poultry before cooking',
                        'Choose low-fat dairy or plant-based alternatives'
                    ]
                })
            
            # 5. SODIUM - Often overlooked
            if daily_averages.get('sodium', 0) > FoodTrackingService.DAILY_THRESHOLDS['sodium']['optimal_max']:
                sodium_amt = daily_averages.get('sodium', 0)
                recommendations.append({
                    'category': 'Sodium',
                    'priority': 'Medium',
                    'message': f'Your sodium intake ({sodium_amt:.0f}mg) exceeds 2300mg. High sodium increases diabetes and heart disease risk.',
                    'actionable_tips': [
                        'Cook at home more - restaurant food is high in sodium',
                        'Rinse canned beans and vegetables before eating',
                        'Use herbs and spices instead of salt for flavor',
                        'Avoid processed meats, canned soups, and salty snacks',
                        'Choose "no salt added" or "low sodium" versions'
                    ]
                })
            
            # 6. CALORIES - Energy balance
            calories = daily_averages.get('calories', 0)
            if calories > FoodTrackingService.DAILY_THRESHOLDS['calories']['optimal_max']:
                excess_cal = calories - 2200
                recommendations.append({
                    'category': 'Calorie Balance',
                    'priority': 'Medium',
                    'message': f'Your calorie intake ({calories:.0f}) is {excess_cal:.0f} above recommendation. Excess calories increase diabetes risk.',
                    'actionable_tips': [
                        'Use smaller plates to control portion sizes',
                        'Eat slowly and stop when 80% full',
                        'Avoid eating straight from packages - portion out servings',
                        'Fill half your plate with vegetables to reduce calorie density'
                    ]
                })
            elif calories < FoodTrackingService.DAILY_THRESHOLDS['calories']['optimal_min']:
                deficit_cal = 1800 - calories
                recommendations.append({
                    'category': 'Calorie Balance',
                    'priority': 'Medium',
                    'message': f'Your calorie intake ({calories:.0f}) is {deficit_cal:.0f} below recommendation. Undereating can slow metabolism.',
                    'actionable_tips': [
                        'Add healthy snacks: nuts, Greek yogurt, or hummus with veggies',
                        'Include healthy fats: avocado, olive oil, or nut butter',
                        'Ensure 3 balanced meals daily',
                        'Consider consulting a nutritionist if consistently under-eating'
                    ]
                })
            
            # 7. PROTEIN - Important for satiety
            protein = daily_averages.get('protein', 0)
            if protein < FoodTrackingService.DAILY_THRESHOLDS['protein']['optimal_min']:
                protein_deficit = 50 - protein
                recommendations.append({
                    'category': 'Protein',
                    'priority': 'Medium',
                    'message': f'Your protein intake ({protein:.1f}g) is {protein_deficit:.1f}g below optimal. Adequate protein helps control blood sugar.',
                    'actionable_tips': [
                        'Include protein at every meal: eggs, chicken, fish, beans, tofu',
                        'Greek yogurt has 15-20g protein per serving',
                        'Add hemp seeds or chia seeds to smoothies (5g protein/tbsp)',
                        'Snack on hard-boiled eggs, cottage cheese, or edamame'
                    ]
                })
            
            # 8. CARBOHYDRATES - Balance is key
            carbs = daily_averages.get('carbs', 0)
            if carbs > FoodTrackingService.DAILY_THRESHOLDS['carbs']['high_risk']:
                recommendations.append({
                    'category': 'Carbohydrates',
                    'priority': 'High',
                    'message': f'Your carbohydrate intake ({carbs:.1f}g) is very high. Reduce refined carbs to improve blood sugar control.',
                    'actionable_tips': [
                        'Reduce portion sizes of rice, pasta, and bread',
                        'Replace half your grain portion with extra vegetables',
                        'Choose low-carb alternatives: cauliflower rice, zucchini noodles',
                        'Focus on protein and healthy fats for satiety'
                    ]
                })
            
            # Get baseline assessment for behavioral recommendations
            baseline_result = FoodBaselineAssessment.get_user_baseline(user_id)
            if baseline_result['success'] and baseline_result.get('baseline'):
                responses = baseline_result['baseline'].get('responses', {})
                
                # MEAL PATTERN RECOMMENDATIONS
                if responses.get('skip_breakfast') in ['Often (5-6 times/week)', 'Always (daily)']:
                    recommendations.append({
                        'category': 'Meal Timing',
                        'priority': 'High',
                        'message': 'Skipping breakfast regularly increases diabetes risk by 20-30% and leads to overeating later.',
                        'actionable_tips': [
                            'Prep overnight oats the night before for quick breakfast',
                            'Keep hard-boiled eggs ready for grab-and-go protein',
                            'Try a protein smoothie if you\'re not hungry in morning',
                            'Even a small balanced breakfast is better than none'
                        ]
                    })
                
                if responses.get('late_night_eating') in ['Often (5-6 times/week)', 'Always (daily)']:
                    recommendations.append({
                        'category': 'Meal Timing',
                        'priority': 'Medium',
                        'message': 'Late-night eating disrupts metabolism and impairs glucose tolerance. Try to finish eating 2-3 hours before bed.',
                        'actionable_tips': [
                            'Set a kitchen "closing time" - e.g., no eating after 8 PM',
                            'Brush teeth after dinner to reduce urge to snack',
                            'If hungry, choose protein: Greek yogurt, cottage cheese, nuts',
                            'Adequate daytime meals reduce nighttime hunger'
                        ]
                    })
                
                if responses.get('sugary_drinks_frequency') in ['Often (5-6 times/week)', 'Daily']:
                    recommendations.append({
                        'category': 'Beverages',
                        'priority': 'High',
                        'message': 'Daily sugary drinks increase diabetes risk by 26%. This is one of the easiest changes with biggest impact.',
                        'actionable_tips': [
                            'Gradually dilute juice with water, then switch to plain water',
                            'Try sparkling water with fresh lemon, lime, or berries',
                            'Unsweetened iced tea with mint is refreshing',
                            'If you need caffeine, choose black coffee or tea'
                        ]
                    })
                
                if responses.get('processed_food_frequency') in ['Often (5-6 times/week)', 'Daily']:
                    recommendations.append({
                        'category': 'Food Quality',
                        'priority': 'High',
                        'message': 'Frequent processed food consumption increases diabetes risk. Aim for whole, minimally processed foods.',
                        'actionable_tips': [
                            'Batch cook healthy meals on weekends for easy weekday dinners',
                            'Keep frozen vegetables for quick, healthy sides',
                            'Read labels - avoid items with >5 ingredients you can\'t pronounce',
                            'Shop the perimeter of grocery stores (fresh foods)'
                        ]
                    })
            
                
                if responses.get('eating_out_frequency') in ['Often (5-6 times/week)', 'Daily']:
                    recommendations.append({
                        'category': 'Meal Planning',
                        'priority': 'Medium',
                        'message': 'Frequent restaurant meals are high in calories, sodium, and unhealthy fats. Home cooking gives you control.',
                        'actionable_tips': [
                            'Start with cooking 1-2 more meals at home per week',
                            'Use meal kit services to learn new recipes easily',
                            'When eating out, request dressing/sauce on side',
                            'Share entrees or save half for tomorrow\'s lunch'
                        ]
                    })
                
                if responses.get('water_intake') and int(responses.get('water_intake', 0)) < 6:
                    recommendations.append({
                        'category': 'Hydration',
                        'priority': 'Low',
                        'message': f'You\'re drinking {responses.get("water_intake", 0)} glasses of water daily. Aim for 8+ glasses for optimal health.',
                        'actionable_tips': [
                            'Keep a reusable water bottle with you at all times',
                            'Drink a glass of water when you wake up',
                            'Set hourly phone reminders to drink water',
                            'Herbal tea counts toward hydration'
                        ]
                    })
            
            # Sort recommendations by priority
            priority_order = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
            recommendations.sort(key=lambda x: priority_order.get(x.get('priority', 'Low'), 3))
            
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
