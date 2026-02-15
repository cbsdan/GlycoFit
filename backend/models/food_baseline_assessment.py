from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class FoodBaselineAssessment:
    """
    Model for storing user's baseline food intake assessment
    Based on research factors affecting prediabetes risk
    """
    
    # Research-based baseline questions
    BASELINE_QUESTIONS = {
        'daily_meal_frequency': {
            'question': 'How many meals do you typically eat per day?',
            'type': 'number',
            'options': None,
            'risk_weight': 0.05  # Meal frequency affects metabolism
        },
        'skip_breakfast': {
            'question': 'How often do you skip breakfast?',
            'type': 'scale',
            'options': ['Never', 'Rarely (1-2 times/week)', 'Sometimes (3-4 times/week)', 'Often (5-6 times/week)', 'Always (daily)'],
            'risk_weight': 0.08  # Skipping breakfast linked to insulin resistance
        },
        'late_night_eating': {
            'question': 'How often do you eat within 2 hours before bedtime?',
            'type': 'scale',
            'options': ['Never', 'Rarely (1-2 times/week)', 'Sometimes (3-4 times/week)', 'Often (5-6 times/week)', 'Always (daily)'],
            'risk_weight': 0.07  # Late eating affects glucose metabolism
        },
        'sugary_drinks_frequency': {
            'question': 'How often do you consume sugary drinks (soda, sweetened juice, energy drinks)?',
            'type': 'scale',
            'options': ['Never', 'Rarely (1-2 times/week)', 'Sometimes (3-4 times/week)', 'Often (5-6 times/week)', 'Daily'],
            'risk_weight': 0.12  # High correlation with diabetes risk
        },
        'processed_food_frequency': {
            'question': 'How often do you eat processed/fast food?',
            'type': 'scale',
            'options': ['Never', 'Rarely (1-2 times/week)', 'Sometimes (3-4 times/week)', 'Often (5-6 times/week)', 'Daily'],
            'risk_weight': 0.10  # Processed foods high in refined carbs
        },
        'whole_grains_intake': {
            'question': 'How often do you consume whole grains (brown rice, whole wheat, oats)?',
            'type': 'scale',
            'options': ['Never', 'Rarely', 'Sometimes', 'Often', 'Daily'],
            'risk_weight': -0.08  # Protective factor (negative = reduces risk)
        },
        'vegetable_servings': {
            'question': 'How many servings of vegetables do you eat daily?',
            'type': 'number',
            'options': None,
            'risk_weight': -0.06  # Protective factor
        },
        'fruit_servings': {
            'question': 'How many servings of fruits do you eat daily?',
            'type': 'number',
            'options': None,
            'risk_weight': -0.05  # Protective factor (moderate due to natural sugars)
        },
        'red_meat_frequency': {
            'question': 'How often do you consume red meat (beef, pork, lamb)?',
            'type': 'scale',
            'options': ['Never', 'Rarely (1-2 times/week)', 'Sometimes (3-4 times/week)', 'Often (5-6 times/week)', 'Daily'],
            'risk_weight': 0.07  # Associated with increased diabetes risk
        },
        'fried_food_frequency': {
            'question': 'How often do you eat fried foods?',
            'type': 'scale',
            'options': ['Never', 'Rarely (1-2 times/week)', 'Sometimes (3-4 times/week)', 'Often (5-6 times/week)', 'Daily'],
            'risk_weight': 0.09  # High in unhealthy fats
        },
        'snacking_frequency': {
            'question': 'How many times do you snack between meals daily?',
            'type': 'number',
            'options': None,
            'risk_weight': 0.04  # Frequent snacking can affect insulin sensitivity
        },
        'portion_size_awareness': {
            'question': 'How would you describe your typical portion sizes?',
            'type': 'scale',
            'options': ['Small', 'Moderate', 'Large', 'Very Large', 'Unsure'],
            'risk_weight': 0.08  # Larger portions increase caloric intake
        },
        'fiber_rich_foods': {
            'question': 'How often do you eat fiber-rich foods (legumes, beans, lentils)?',
            'type': 'scale',
            'options': ['Never', 'Rarely', 'Sometimes', 'Often', 'Daily'],
            'risk_weight': -0.09  # Strong protective factor
        },
        'refined_carbs_frequency': {
            'question': 'How often do you consume refined carbohydrates (white bread, white rice, pastries)?',
            'type': 'scale',
            'options': ['Never', 'Rarely', 'Sometimes', 'Often', 'Daily'],
            'risk_weight': 0.11  # High glycemic index foods
        },
        'water_intake': {
            'question': 'How many glasses of water do you drink daily?',
            'type': 'number',
            'options': None,
            'risk_weight': -0.03  # Adequate hydration helps metabolism
        },
        'eating_speed': {
            'question': 'How would you describe your eating speed?',
            'type': 'scale',
            'options': ['Very Slow', 'Slow', 'Moderate', 'Fast', 'Very Fast'],
            'risk_weight': 0.06  # Fast eating linked to insulin resistance
        }
    }
    
    def __init__(self, user_id, responses=None):
        self.user_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        self.responses = responses if responses else {}
        self.baseline_risk_score = 0
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.last_calculated = None
    
    def to_dict(self):
        """Convert to dictionary for MongoDB storage"""
        return {
            'user_id': self.user_id,
            'responses': self.responses,
            'baseline_risk_score': self.baseline_risk_score,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'last_calculated': self.last_calculated
        }
    
    @staticmethod
    def get_baseline_questions():
        """Get all baseline questions for the assessment"""
        questions = []
        for key, value in FoodBaselineAssessment.BASELINE_QUESTIONS.items():
            questions.append({
                'key': key,
                'question': value['question'],
                'type': value['type'],
                'options': value['options']
            })
        return questions
    
    @staticmethod
    def create_or_update_baseline(user_id, responses):
        """Create or update baseline assessment for a user"""
        try:
            db = get_db()
            
            # Check if baseline already exists
            existing = db.food_baseline_assessments.find_one({
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id
            })
            
            if existing:
                # Update existing baseline
                update_data = {
                    'responses': responses,
                    'updated_at': datetime.utcnow()
                }
                
                result = db.food_baseline_assessments.update_one(
                    {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id},
                    {'$set': update_data}
                )
                
                log_database_operation('update_one', 'food_baseline_assessments', update_data, result)
                
                logging.info(f"Updated baseline assessment for user {user_id}")
                
                return {
                    'success': True,
                    'message': 'Baseline assessment updated successfully',
                    'assessment_id': str(existing['_id'])
                }
            else:
                # Create new baseline
                assessment = FoodBaselineAssessment(user_id=user_id, responses=responses)
                result = db.food_baseline_assessments.insert_one(assessment.to_dict())
                
                log_database_operation('insert_one', 'food_baseline_assessments', assessment.to_dict(), result)
                
                logging.info(f"Created baseline assessment for user {user_id}: {result.inserted_id}")
                
                return {
                    'success': True,
                    'message': 'Baseline assessment created successfully',
                    'assessment_id': str(result.inserted_id)
                }
                
        except Exception as e:
            logging.error(f"Error creating/updating baseline for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def get_user_baseline(user_id):
        """Get baseline assessment for a user with detailed breakdown"""
        try:
            db = get_db()
            
            baseline = db.food_baseline_assessments.find_one({
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id
            })
            
            if baseline:
                return {
                    'success': True,
                    'baseline': {
                        'id': str(baseline['_id']),
                        'responses': baseline.get('responses', {}),
                        'baseline_risk_score': baseline.get('baseline_risk_score', 0),
                        'question_contributions': baseline.get('question_contributions', {}),
                        'created_at': baseline.get('created_at').isoformat() if baseline.get('created_at') else None,
                        'updated_at': baseline.get('updated_at').isoformat() if baseline.get('updated_at') else None,
                        'last_calculated': baseline.get('last_calculated').isoformat() if baseline.get('last_calculated') else None
                    }
                }
            else:
                return {
                    'success': True,
                    'baseline': None,
                    'message': 'No baseline assessment found'
                }
                
        except Exception as e:
            logging.error(f"Error getting baseline for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def calculate_baseline_risk_score(responses):
        """
        Calculate risk score from baseline responses
        Score ranges from 0 (low risk) to 100 (high risk)
        Returns both overall score and detailed breakdown
        """
        total_score = 0
        max_possible_score = 0
        question_contributions = {}
        
        for key, value in responses.items():
            if key not in FoodBaselineAssessment.BASELINE_QUESTIONS:
                continue
            
            question_data = FoodBaselineAssessment.BASELINE_QUESTIONS[key]
            risk_weight = question_data['risk_weight']
            question_type = question_data['type']
            
            question_score = 0
            question_max = abs(risk_weight) * 100
            
            if question_type == 'scale':
                # For scale questions, convert answer to numeric score (0-4)
                options = question_data['options']
                if value in options:
                    option_index = options.index(value)
                    
                    # For protective factors (negative weight), higher frequency = lower risk
                    # For risk factors (positive weight), higher frequency = higher risk
                    if risk_weight < 0:
                        # Protective: 'Never' = worst (0 protection), 'Daily/Often' = best (full protection)
                        # Invert: Never=4, Rarely=3, Sometimes=2, Often=1, Daily=0
                        protection_score = (len(options) - 1 - option_index) / (len(options) - 1)
                        question_score = protection_score * abs(risk_weight) * 100
                    else:
                        # Risk: 'Never' = best (0 risk), 'Daily' = worst (full risk)
                        risk_ratio = option_index / (len(options) - 1) if len(options) > 1 else 0
                        question_score = risk_ratio * risk_weight * 100
                    
            elif question_type == 'number':
                numeric_value = float(value) if value else 0
                
                # Normalize numeric values based on expected ranges
                if key == 'daily_meal_frequency':
                    # Optimal is 3-4 meals, deviation increases risk
                    if 3 <= numeric_value <= 4:
                        question_score = 0  # Optimal
                    elif numeric_value < 3:
                        # Too few meals
                        deviation = (3 - numeric_value) / 3
                        question_score = min(deviation, 1.0) * abs(risk_weight) * 100
                    else:
                        # Too many meals
                        deviation = (numeric_value - 4) / 4
                        question_score = min(deviation, 1.0) * abs(risk_weight) * 100
                    
                elif key in ['vegetable_servings', 'fruit_servings']:
                    # More is better (protective factors)
                    # Optimal: 5+ servings vegetables, 2.5-3 servings fruits
                    if key == 'vegetable_servings':
                        optimal = 5
                        if numeric_value >= optimal:
                            question_score = abs(risk_weight) * 100  # Full protection
                        else:
                            # Linear: 0 servings = no protection, 5+ servings = full protection
                            protection_ratio = min(numeric_value / optimal, 1.0)
                            question_score = protection_ratio * abs(risk_weight) * 100
                    else:  # fruit_servings
                        optimal_min = 2
                        optimal_max = 3
                        if optimal_min <= numeric_value <= optimal_max:
                            question_score = abs(risk_weight) * 100  # Full protection
                        elif numeric_value < optimal_min:
                            # Too little fruit
                            protection_ratio = numeric_value / optimal_min
                            question_score = protection_ratio * abs(risk_weight) * 100
                        else:
                            # Too much fruit (natural sugars)
                            excess_ratio = min((numeric_value - optimal_max) / optimal_max, 0.5)
                            question_score = (1 - excess_ratio) * abs(risk_weight) * 100
                        
                elif key == 'snacking_frequency':
                    # Optimal: 1-2 snacks, more increases risk
                    if numeric_value <= 2:
                        question_score = 0  # Optimal
                    else:
                        # Excess snacking: linear increase in risk
                        excess = min((numeric_value - 2) / 4, 1.0)  # Cap at 6+ snacks
                        question_score = excess * abs(risk_weight) * 100
                    
                elif key == 'water_intake':
                    # 8+ glasses is optimal
                    optimal = 8
                    if numeric_value >= optimal:
                        question_score = abs(risk_weight) * 100  # Full protection
                    else:
                        # Linear: 0 glasses = no protection, 8+ = full protection
                        protection_ratio = numeric_value / optimal
                        question_score = protection_ratio * abs(risk_weight) * 100
            
            # Store contribution for detailed breakdown
            contribution_percent = (question_score / question_max * 100) if question_max > 0 else 0
            question_contributions[key] = {
                'response': value,
                'risk_weight': risk_weight,
                'score': round(question_score, 2),
                'max_score': round(question_max, 2),
                'contribution_percent': round(contribution_percent, 2),
                'is_protective': risk_weight < 0
            }
            
            total_score += question_score
            max_possible_score += question_max
        
        # Calculate percentage risk score
        if max_possible_score > 0:
            risk_score = (total_score / max_possible_score) * 100
        else:
            risk_score = 0
        
        # Ensure score is between 0 and 100
        risk_score = max(0, min(100, risk_score))
        
        return {
            'risk_score': round(risk_score, 2),
            'total_score': round(total_score, 2),
            'max_possible_score': round(max_possible_score, 2),
            'question_contributions': question_contributions
        }
    
    @staticmethod
    def update_baseline_risk_score(user_id):
        """Recalculate and update baseline risk score with detailed breakdown"""
        try:
            db = get_db()
            
            baseline = db.food_baseline_assessments.find_one({
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id
            })
            
            if not baseline:
                return {
                    'success': False,
                    'error': 'Baseline assessment not found'
                }
            
            responses = baseline.get('responses', {})
            result = FoodBaselineAssessment.calculate_baseline_risk_score(responses)
            
            risk_score = result['risk_score']
            question_contributions = result['question_contributions']
            
            # Update the baseline with new risk score and breakdown
            update_result = db.food_baseline_assessments.update_one(
                {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id},
                {
                    '$set': {
                        'baseline_risk_score': risk_score,
                        'question_contributions': question_contributions,
                        'last_calculated': datetime.utcnow()
                    }
                }
            )
            
            log_database_operation('update_one', 'food_baseline_assessments', {'user_id': user_id}, update_result)
            
            return {
                'success': True,
                'baseline_risk_score': risk_score,
                'question_contributions': question_contributions
            }
            
        except Exception as e:
            logging.error(f"Error updating baseline risk score for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
