"""
Lifestyle Recommendation Controller

API endpoints for unified lifestyle recommendations and timeline predictions.
Consolidates data from all lifestyle trackers:
- Food intake
- Sleep patterns
- Physical activity (steps)
- Alcohol consumption
- Smoking status
"""

from flask import jsonify, request
import logging
from services.lifestyle_recommendation_service import get_lifestyle_recommendation_service
from services.lifestyle_ml_service import get_lifestyle_ml_service
from services.food_tracking_service import FoodTrackingService
from services.sleep_tracking_service import get_sleep_tracking_service
from services.step_tracking_service import StepTrackingService
from services.smoking_tracking_service import get_smoking_tracking_service
from models.alcohol_intake import AlcoholBaseline, AlcoholMetrics
from models.smoking_tracking import SmokingBaseline, SmokingMetrics
from models.step_tracking import StepBaseline
from models.overall_risk_assessment import OverallRiskAssessment
from models.user import User

logger = logging.getLogger(__name__)


def _user_field(user_obj, key, default=None):
    """Read a user field from either model instance or dict-like payload."""
    if user_obj is None:
        return default
    if isinstance(user_obj, dict):
        return user_obj.get(key, default)
    return getattr(user_obj, key, default)


def _bool_query(value) -> bool:
    return str(value).strip().lower() in ('1', 'true', 'yes', 'y', 'on')


MOCK_PRESETS = {
    'conservative': {
        'profile': {
            'age': 30,
            'bmi': 21.8,
        },
        'food': {
            'avg_glycemic_load': 150,
            'avg_fiber_grams': 12,
            'avg_added_sugars': 48,
            'avg_calories': 2350,
            'duration_days': 7,
            'baseline_risk_score': 60,
            'risk_score': 63,
            'risk_category': 'high',
        },
        'activity': {
            'avg_daily_steps': 2800,
            'days_goal_met': 2,
            'duration_days': 30,
            'risk_score': 75,
        },
        'alcohol': {
            'drinks_per_week': 10,
            'binge_episodes_monthly': 3,
            'duration_days': 30,
        },
    },
    'moderate': {
        'profile': {
            'age': 62,
            'bmi': 32.8,
        },
        'food': {
            'avg_glycemic_load': 90,
            'avg_fiber_grams': 31,
            'avg_added_sugars': 18,
            'avg_calories': 1750,
            'duration_days': 7,
            'baseline_risk_score': 35,
            'risk_score': 32,
            'risk_category': 'low',
        },
        'activity': {
            'avg_daily_steps': 9800,
            'days_goal_met': 22,
            'duration_days': 30,
            'risk_score': 18,
        },
        'alcohol': {
            'drinks_per_week': 1,
            'binge_episodes_monthly': 0,
            'duration_days': 30,
        },
    },
    'aggressive': {
        'profile': {
            'age': 44,
            'bmi': 27.1,
        },
        'food': {
            'avg_glycemic_load': 112,
            'avg_fiber_grams': 20,
            'avg_added_sugars': 29,
            'avg_calories': 1980,
            'duration_days': 7,
            'baseline_risk_score': 48,
            'risk_score': 48,
            'risk_category': 'moderate',
        },
        'activity': {
            'avg_daily_steps': 6100,
            'days_goal_met': 10,
            'duration_days': 30,
            'risk_score': 40,
        },
        'alcohol': {
            'drinks_per_week': 4,
            'binge_episodes_monthly': 1,
            'duration_days': 30,
        },
    },
}


def _normalize_mock_preset(value: str) -> str:
    preset = (value or 'moderate').strip().lower()
    return preset if preset in MOCK_PRESETS else 'moderate'


def _estimate_age_risk_score(age: float) -> float:
    if age <= 0:
        return 0.0
    if age < 35:
        return 10.0
    if age < 45:
        return 25.0
    if age < 55:
        return 45.0
    if age < 65:
        return 65.0
    return 80.0


def _estimate_bmi_risk_score(bmi: float) -> float:
    if bmi <= 0:
        return 0.0
    # WHO Asian cutoffs (used elsewhere in project docs/services).
    if bmi < 23:
        return 10.0
    if bmi < 27.5:
        return 35.0
    if bmi < 32.5:
        return 65.0
    return 85.0


def get_current_user_id():
    """Get the current authenticated user's ID from Firebase auth middleware"""
    return getattr(request, 'current_user_id', None)


def get_unified_recommendations():
    """
    Get unified recommendations for lifestyle ML trackers.
    
    Consolidates data from model-supported trackers and provides:
    - Overall risk assessment
    - Timeline predictions
    - Prioritized recommendations
    - Healthy defaults when data is insufficient
    
    Query Parameters:
    - days: Number of days to analyze (default: 30)
    
    Response:
    {
        "success": true,
        "data": {
            "overall_risk_score": 42,
            "overall_risk_category": "moderate",
            "trackers": {...},
            "priority_actions": [...],
            "healthy_defaults": {...}
        }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        days = int(request.args.get('days', 30))
        if days < 7 or days > 90:
            days = 30
        use_mock = _bool_query(request.args.get('mock', 'false'))
        mock_preset = _normalize_mock_preset(request.args.get('mock_preset', 'moderate'))
        mock_values = MOCK_PRESETS[mock_preset]
        
        service = get_lifestyle_recommendation_service()
        user = User.find_by_id(user_id)
        
        # Gather data from model-supported trackers only (food, activity, alcohol)
        trackers_data = {}
        
        # 1. Food Tracker
        try:
            food_risk = FoodTrackingService.calculate_comprehensive_risk(user_id, days=min(days, 7))
            if food_risk.get('success'):
                daily_analysis = food_risk.get('breakdown', {}).get('daily_analysis', {})
                daily_averages = daily_analysis.get('daily_averages', {})
                
                if daily_averages:
                    food_predictions = service.predict_food_impact(
                        avg_glycemic_load=daily_averages.get('glycemic_load', 100),
                        avg_fiber_grams=daily_averages.get('fiber', 25),
                        avg_added_sugars=daily_averages.get('added_sugars', 25),
                        avg_calories=daily_averages.get('calories', 2000),
                        duration_days=min(days, daily_analysis.get('days_with_data', days)),
                        baseline_risk_score=food_risk.get('breakdown', {}).get('baseline_risk', 50)
                    )
                    trackers_data['food'] = {
                        'has_data': True,
                        'risk_score': food_risk.get('comprehensive_risk_score'),
                        'risk_category': food_risk.get('risk_category'),
                        'predictions': food_predictions
                    }
                else:
                    trackers_data['food'] = {
                        'has_data': False,
                        'healthy_defaults': service.get_healthy_defaults()['guidelines']['diet']
                    }
        except Exception as e:
            logger.error(f"Error getting food data: {e}")
            trackers_data['food'] = {'has_data': False, 'error': str(e)}

        if use_mock:
            food_mock = mock_values['food']
            food_predictions = service.predict_food_impact(
                avg_glycemic_load=food_mock['avg_glycemic_load'],
                avg_fiber_grams=food_mock['avg_fiber_grams'],
                avg_added_sugars=food_mock['avg_added_sugars'],
                avg_calories=food_mock['avg_calories'],
                duration_days=food_mock['duration_days'],
                baseline_risk_score=food_mock['baseline_risk_score']
            )
            trackers_data['food'] = {
                'has_data': True,
                'is_mock': True,
                'mock_preset': mock_preset,
                'risk_score': food_mock['risk_score'],
                'risk_category': food_mock['risk_category'],
                'predictions': food_predictions
            }
        
        # 2. Activity Tracker (Steps)
        try:
            step_metrics = StepTrackingService.compute_metrics(user_id)
            step_baseline_unified = StepBaseline.find_by_user_id(user_id)

            avg_steps_for_pred = None
            days_goal_met_for_pred = 0
            duration_for_pred = 0

            if step_metrics and step_metrics.get('days_with_data_30d', 0) > 0:
                avg_steps_for_pred = int(step_metrics.get('avg_steps_30d', 0))
                days_goal_met_for_pred = step_metrics.get('days_met_goal_30d', 0)
                duration_for_pred = step_metrics.get('days_with_data_30d', 0)
            elif step_baseline_unified:
                avg_steps_for_pred = step_baseline_unified.baseline_avg_daily_steps or 0
                days_active_pw = step_baseline_unified.baseline_days_active_per_week or 0
                days_goal_met_for_pred = round((days_active_pw / 7) * 30)
                duration_for_pred = 30

            if avg_steps_for_pred is not None:
                step_predictions = service.predict_activity_impact(
                    avg_daily_steps=avg_steps_for_pred,
                    days_goal_met=days_goal_met_for_pred,
                    duration_days=duration_for_pred
                )

                # Calculate simple risk score based on steps
                avg_steps = avg_steps_for_pred
                if avg_steps < 3000:
                    step_risk_score = 80
                elif avg_steps < 5000:
                    step_risk_score = 60
                elif avg_steps < 7500:
                    step_risk_score = 40
                elif avg_steps < 10000:
                    step_risk_score = 20
                else:
                    step_risk_score = 10

                trackers_data['activity'] = {
                    'has_data': True,
                    'risk_score': step_risk_score,
                    'avg_steps': avg_steps,
                    'predictions': step_predictions
                }
            else:
                trackers_data['activity'] = {
                    'has_data': False,
                    'healthy_defaults': service.get_healthy_defaults()['guidelines']['activity']
                }
        except Exception as e:
            logger.error(f"Error getting activity data: {e}")
            trackers_data['activity'] = {'has_data': False, 'error': str(e)}

        if use_mock:
            activity_mock = mock_values['activity']
            step_predictions = service.predict_activity_impact(
                avg_daily_steps=activity_mock['avg_daily_steps'],
                days_goal_met=activity_mock['days_goal_met'],
                duration_days=activity_mock['duration_days']
            )
            trackers_data['activity'] = {
                'has_data': True,
                'is_mock': True,
                'mock_preset': mock_preset,
                'risk_score': activity_mock['risk_score'],
                'avg_steps': activity_mock['avg_daily_steps'],
                'predictions': step_predictions
            }
        
        # 3. Alcohol Tracker
        user_gender = 'male'
        try:
            alcohol_metrics = AlcoholMetrics.find_by_user_id(user_id)
            alcohol_baseline = AlcoholBaseline.find_by_user_id(user_id)
            
            # Get user gender for proper thresholds
            user_gender = 'male'
            try:
                user = User.find_by_id(user_id)
                user_gender = (_user_field(user, 'gender', 'male') or 'male').lower()
            except:
                pass
            
            if alcohol_metrics or alcohol_baseline:
                if alcohol_metrics:
                    drinks_per_week = alcohol_metrics.avg_drinks_per_week_30d or 0
                    binge_episodes = alcohol_metrics.binge_episodes_30d or 0
                    data_days = alcohol_metrics.days_with_data_30d or 0
                    # Supplement with baseline binge frequency when no binge episodes logged yet
                    if binge_episodes == 0 and alcohol_baseline:
                        binge_episodes = alcohol_baseline.baseline_binge_frequency_per_month or 0
                elif alcohol_baseline:
                    drinks_per_week = (alcohol_baseline.baseline_drinking_days_per_week or 0) * \
                                      (alcohol_baseline.baseline_drinks_per_occasion or 0)
                    binge_episodes = alcohol_baseline.baseline_binge_frequency_per_month or 0
                    data_days = 0  # Baseline only
                
                alcohol_predictions = service.predict_alcohol_impact(
                    drinks_per_week=drinks_per_week,
                    binge_episodes_monthly=binge_episodes,
                    duration_days=data_days if data_days > 0 else 30,
                    gender=user_gender
                )
                trackers_data['alcohol'] = {
                    'has_data': True,
                    'risk_multiplier': alcohol_predictions.get('risk_multiplier', 1.0),
                    'risk_category': alcohol_predictions.get('risk_category'),
                    'predictions': alcohol_predictions
                }
            else:
                trackers_data['alcohol'] = {
                    'has_data': False,
                    'healthy_defaults': service.get_healthy_defaults()['guidelines']['alcohol']
                }
        except Exception as e:
            logger.error(f"Error getting alcohol data: {e}")
            trackers_data['alcohol'] = {'has_data': False, 'error': str(e)}

        if use_mock:
            alcohol_mock = mock_values['alcohol']
            alcohol_predictions = service.predict_alcohol_impact(
                drinks_per_week=alcohol_mock['drinks_per_week'],
                binge_episodes_monthly=alcohol_mock['binge_episodes_monthly'],
                duration_days=alcohol_mock['duration_days'],
                gender=user_gender
            )
            trackers_data['alcohol'] = {
                'has_data': True,
                'is_mock': True,
                'mock_preset': mock_preset,
                'risk_multiplier': alcohol_predictions.get('risk_multiplier', 1.0),
                'risk_category': alcohol_predictions.get('risk_category'),
                'predictions': alcohol_predictions
            }
        
        # Build ML input payload (food + activity + alcohol only)
        ml_inputs = {
            'food': {},
            'activity': {},
            'alcohol': {},
            'profile': {}
        }

        # Optional profile features used by some trained models.
        if user:
            age_value = _user_field(user, 'age')
            if age_value is None:
                dob_value = _user_field(user, 'date_of_birth') or _user_field(user, 'birth_date') or _user_field(user, 'dob')
            else:
                dob_value = None

            if age_value is None and dob_value:
                try:
                    from datetime import datetime
                    dob = dob_value
                    dob_dt = datetime.fromisoformat(dob.replace('Z', '+00:00')) if isinstance(dob, str) else dob
                    age_value = int((datetime.utcnow() - dob_dt.replace(tzinfo=None)).days / 365.25)
                except Exception:
                    age_value = None

            bmi_value = _user_field(user, 'bmi')
            if bmi_value is None:
                bmi_value = _user_field(user, 'body_mass_index')

            if bmi_value is None:
                try:
                    weight_kg = None
                    if _user_field(user, 'weight_kg') is not None:
                        weight_kg = float(_user_field(user, 'weight_kg'))
                    elif _user_field(user, 'weight') is not None:
                        weight_kg = float(_user_field(user, 'weight'))

                    height_cm = None
                    if _user_field(user, 'height_cm') is not None:
                        height_cm = float(_user_field(user, 'height_cm'))
                    elif _user_field(user, 'height') is not None:
                        # Assume meters for typical profile `height` values <= 3, otherwise cm.
                        raw_height = float(_user_field(user, 'height'))
                        height_cm = raw_height * 100.0 if raw_height <= 3 else raw_height

                    if weight_kg and height_cm and height_cm > 0:
                        bmi_value = weight_kg / ((height_cm / 100.0) ** 2)
                except Exception:
                    bmi_value = None

            if age_value is not None:
                ml_inputs['profile']['age'] = age_value
            if bmi_value is not None:
                ml_inputs['profile']['bmi'] = bmi_value

        if use_mock:
            profile_mock = mock_values.get('profile', {})
            if profile_mock.get('age') is not None:
                ml_inputs['profile']['age'] = profile_mock['age']
            if profile_mock.get('bmi') is not None:
                ml_inputs['profile']['bmi'] = profile_mock['bmi']

        if trackers_data.get('food', {}).get('has_data'):
            current_pattern = trackers_data['food'].get('predictions', {}).get('current_pattern', {})
            ml_inputs['food'] = {
                'glycemic_load': current_pattern.get('avg_glycemic_load', 0),
                'fiber': current_pattern.get('avg_fiber_grams', 0),
                'added_sugars': current_pattern.get('avg_added_sugars', 0),
                'calories': current_pattern.get('avg_calories', 0)
            }

        if trackers_data.get('activity', {}).get('has_data'):
            current_pattern = trackers_data['activity'].get('predictions', {}).get('current_pattern', {})
            ml_inputs['activity'] = {
                'avg_daily_steps': current_pattern.get('avg_daily_steps', trackers_data['activity'].get('avg_steps', 0)),
                'days_goal_met': current_pattern.get('days_goal_met', 0),
                'duration_days': current_pattern.get('duration_days', 0)
            }

        if trackers_data.get('alcohol', {}).get('has_data'):
            current_pattern = trackers_data['alcohol'].get('predictions', {}).get('current_pattern', {})
            ml_inputs['alcohol'] = {
                'drinks_per_week': current_pattern.get('drinks_per_week', 0),
                'binge_episodes_monthly': current_pattern.get('binge_episodes_monthly', 0),
                'duration_days': current_pattern.get('duration_days', 0)
            }

        diagnosis_status = (_user_field(user, 'diagnosis_status', '') or '').strip().lower()
        has_food_data = bool(trackers_data.get('food', {}).get('has_data'))
        has_activity_data = bool(trackers_data.get('activity', {}).get('has_data'))
        is_untested_user = not (has_food_data and has_activity_data)
        should_use_lifestyle_model = diagnosis_status == 'prediabetes' or is_untested_user

        ml_service = get_lifestyle_ml_service()
        model_prediction = (
            ml_service.predict(ml_inputs)
            if should_use_lifestyle_model and ml_service.is_initialized
            else None
        )

        # Keep recommendation aggregation from current rule-based service, but limited to model trackers.
        food_risk_data = trackers_data.get('food', {}).get('predictions') if trackers_data.get('food', {}).get('has_data') else None
        activity_risk_data = trackers_data.get('activity', {}).get('predictions') if trackers_data.get('activity', {}).get('has_data') else None
        alcohol_risk_data = trackers_data.get('alcohol', {}).get('predictions') if trackers_data.get('alcohol', {}).get('has_data') else None

        overall_assessment = service.calculate_overall_lifestyle_risk(
            food_risk=food_risk_data,
            activity_risk=activity_risk_data,
            alcohol_risk=alcohol_risk_data
        )

        if model_prediction:
            overall_assessment['overall_risk_score'] = model_prediction.get('percentage', overall_assessment['overall_risk_score'])
            overall_assessment['overall_risk_category'] = model_prediction.get('risk_level', overall_assessment['overall_risk_category'])

        # Build assessment-tab compatible structure.
        # Calibrated to your updated trained model feature-importance profile:
        # BMXBMI 0.381725, RIDAGEYR 0.273090, DRXTSUGR 0.092315,
        # DRXTKCAL 0.087651, PAQ605 0.084193, ALQ130 0.081027.
        # Food tracker is represented as a combined sugar+calorie contribution.
        component_weights = {
            'food': 0.179966,      # DRXTSUGR + DRXTKCAL
            'activity': 0.084193,  # PAQ605
            'alcohol': 0.081027,   # ALQ130
            'age': 0.273090,       # RIDAGEYR
            'bmi': 0.381725,       # BMXBMI
        }

        food_raw = trackers_data.get('food', {}).get('risk_score', 0) if trackers_data.get('food', {}).get('has_data') else 0
        activity_raw = trackers_data.get('activity', {}).get('risk_score', 0) if trackers_data.get('activity', {}).get('has_data') else 0
        alcohol_risk_multiplier = trackers_data.get('alcohol', {}).get('risk_multiplier', 1.0) if trackers_data.get('alcohol', {}).get('has_data') else 1.0
        alcohol_raw = min(100, max(0, round((alcohol_risk_multiplier - 1.0) * 100, 2)))

        age_raw = float(ml_inputs.get('profile', {}).get('age', 0) or 0)
        bmi_raw = float(ml_inputs.get('profile', {}).get('bmi', 0) or 0)
        age_risk_score = _estimate_age_risk_score(age_raw)
        bmi_risk_score = _estimate_bmi_risk_score(bmi_raw)

        component_scores = {
            'food': {
                'raw_score': round(float(food_raw), 2),
                'weighted_score': round(float(food_raw) * component_weights['food'], 2),
                'weight': component_weights['food'],
                'status': trackers_data.get('food', {}).get('risk_category', 'no_data') if trackers_data.get('food', {}).get('has_data') else 'no_data',
                'details': 'Daily food contribution (sugar/calorie-driven)',
                'has_data': bool(trackers_data.get('food', {}).get('has_data')),
            },
            'activity': {
                'raw_score': round(float(activity_raw), 2),
                'weighted_score': round(float(activity_raw) * component_weights['activity'], 2),
                'weight': component_weights['activity'],
                'status': trackers_data.get('activity', {}).get('predictions', {}).get('activity_category', 'no_data') if trackers_data.get('activity', {}).get('has_data') else 'no_data',
                'details': 'Physical activity/step tracker contribution',
                'has_data': bool(trackers_data.get('activity', {}).get('has_data')),
            },
            'alcohol': {
                'raw_score': round(float(alcohol_raw), 2),
                'weighted_score': round(float(alcohol_raw) * component_weights['alcohol'], 2),
                'weight': component_weights['alcohol'],
                'status': trackers_data.get('alcohol', {}).get('risk_category', 'no_data') if trackers_data.get('alcohol', {}).get('has_data') else 'no_data',
                'details': 'Alcohol intake tracker contribution',
                'has_data': bool(trackers_data.get('alcohol', {}).get('has_data')),
            },
            'age': {
                'raw_score': round(age_risk_score, 2),
                'input_value': round(age_raw, 2),
                'weighted_score': round(float(age_risk_score) * component_weights['age'], 2),
                'weight': component_weights['age'],
                'status': 'profile' if age_raw > 0 else 'missing',
                'details': 'Age fetched from profile and converted to an age-risk contribution for display',
                'has_data': age_raw > 0,
            },
            'bmi': {
                'raw_score': round(bmi_risk_score, 2),
                'input_value': round(bmi_raw, 2),
                'weighted_score': round(float(bmi_risk_score) * component_weights['bmi'], 2),
                'weight': component_weights['bmi'],
                'status': 'profile' if bmi_raw > 0 else 'missing',
                'details': 'BMI fetched/computed from profile and converted to a BMI-risk contribution for display',
                'has_data': bmi_raw > 0,
            },
        }

        primary_risk_factors = []
        component_name_map = {
            'food': 'Diet & Nutrition',
            'activity': 'Physical Activity',
            'alcohol': 'Alcohol Consumption',
            'age': 'Age Factor',
            'bmi': 'Body Mass Index',
        }
        for key, score_info in component_scores.items():
            if score_info.get('has_data'):
                primary_risk_factors.append({
                    'component': key,
                    'component_name': component_name_map.get(key, key.title()),
                    'weighted_score': score_info.get('weighted_score', 0),
                    'raw_score': score_info.get('raw_score', 0),
                    'weight_percentage': int(score_info.get('weight', 0) * 100),
                    'details': score_info.get('details', ''),
                    'status': score_info.get('status', 'unknown')
                })
        primary_risk_factors.sort(key=lambda x: x['weighted_score'], reverse=True)

        # If model prediction is unavailable, derive overall score from visible component contributions
        # to avoid a constant fallback score for users with different age/BMI/profile states.
        if not model_prediction:
            derived_score = 0.0
            for score_info in component_scores.values():
                if score_info.get('has_data'):
                    derived_score += float(score_info.get('weighted_score', 0.0))
            derived_score = round(max(0.0, min(100.0, derived_score)), 2)
            overall_assessment['overall_risk_score'] = derived_score
            overall_assessment['overall_risk_category'] = OverallRiskAssessment.classify_risk_category(derived_score)

        recommendations = []
        for rec in overall_assessment.get('all_recommendations', [])[:10]:
            title = rec.get('title')
            msg = rec.get('message')
            if title and msg:
                recommendations.append(f"{title}: {msg}")
            elif title:
                recommendations.append(title)

        if not recommendations:
            if age_raw >= 55:
                recommendations.append(
                    f"Prioritize regular screening: Your age ({age_raw:.0f}) increases baseline diabetes risk even with good habits."
                )
            if bmi_raw >= 27.5:
                recommendations.append(
                    f"Focus on weight management: BMI ({bmi_raw:.1f}) is above the Asian high-risk cutoff and can elevate long-term risk."
                )
            if not recommendations:
                recommendations.append(
                    "Maintain current lifestyle habits: Your recent tracker patterns are protective; continue consistent diet, activity, and alcohol control."
                )

        trackers_with_data = [k for k in ['food', 'activity', 'alcohol'] if trackers_data.get(k, {}).get('has_data')]
        if len(trackers_with_data) == 3:
            confidence_level = 'high'
        elif len(trackers_with_data) == 2:
            confidence_level = 'moderate'
        elif len(trackers_with_data) == 1:
            confidence_level = 'low'
        else:
            confidence_level = 'preliminary'

        missing_trackers = [k for k in ['food', 'activity', 'alcohol'] if k not in trackers_with_data]
        used_mock_trackers = [
            k for k in ['food', 'activity', 'alcohol']
            if trackers_data.get(k, {}).get('is_mock')
        ]
        if missing_trackers and not used_mock_trackers:
            data_quality_notes = f"Missing lifestyle tracker data: {', '.join(missing_trackers)}. Results use available data and profile features (age/BMI)."
        elif used_mock_trackers:
            data_quality_notes = f"Using {mock_preset} mock preset for: {', '.join(used_mock_trackers)} (enable for testing with ?mock=true&mock_preset={mock_preset}). Age/BMI are overridden by mock profile values for scenario testing."
        else:
            data_quality_notes = 'All model-supported lifestyle trackers are available.'

        category_info = OverallRiskAssessment.get_risk_category_info(overall_assessment['overall_risk_category'])

        # Persist ML-based assessment to overall_risk_assessments so admin charts stay current.
        # Skip for mock requests to avoid polluting production data.
        if not use_mock:
            try:
                assessment_record = OverallRiskAssessment(
                    user_id=user_id,
                    overall_risk_score=overall_assessment['overall_risk_score'],
                    overall_risk_category=overall_assessment['overall_risk_category'],
                    confidence_level=confidence_level,
                    component_scores=component_scores,
                    primary_risk_factors=primary_risk_factors,
                    protective_factors=[],
                    key_improvements=overall_assessment['priority_actions'][:3],
                    recommendations=recommendations,
                    explanation=data_quality_notes,
                    data_quality_notes=data_quality_notes,
                )
                assessment_record.save()
            except Exception as persist_err:
                logger.warning(f"Could not persist lifestyle assessment for user {user_id}: {persist_err}")

        return jsonify({
            'success': True,
            'data': {
                'overall_risk_score': overall_assessment['overall_risk_score'],
                'overall_risk_category': overall_assessment['overall_risk_category'],
                'category_info': category_info,
                'confidence_level': confidence_level,
                'component_scores': component_scores,
                'primary_risk_factors': primary_risk_factors,
                'protective_factors': [],
                'key_improvements': overall_assessment['priority_actions'][:3],
                'recommendations': recommendations,
                'data_quality_notes': data_quality_notes,
                'trackers': trackers_data,
                'trackers_analyzed': trackers_with_data,
                'trackers_missing': missing_trackers,
                'model_prediction': model_prediction,
                'model_used': bool(model_prediction),
                'model_eligibility': {
                    'diagnosis_status': diagnosis_status or 'unknown',
                    'is_untested_user': is_untested_user,
                    'should_use_model': should_use_lifestyle_model,
                    'policy': 'Lifestyle ML model is used only for untested or prediabetic users.'
                },
                'model_inputs': {
                    'profile': {
                        'age': ml_inputs.get('profile', {}).get('age'),
                        'bmi': ml_inputs.get('profile', {}).get('bmi')
                    }
                },
                'mock_info': {
                    'enabled': bool(use_mock),
                    'preset': mock_preset if use_mock else None,
                    'used_trackers': used_mock_trackers,
                },
                'priority_actions': overall_assessment['priority_actions'],
                'all_recommendations': overall_assessment['all_recommendations'][:10],  # Top 10
                'healthy_defaults': overall_assessment['healthy_defaults']
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting unified recommendations: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_food_predictions():
    """
    Get food-specific timeline predictions.
    
    Query Parameters:
    - days: Number of days to analyze (default: 7)
    
    Response includes timeline predictions based on current dietary patterns.
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        days = int(request.args.get('days', 7))
        
        service = get_lifestyle_recommendation_service()
        
        # Get food risk data
        food_risk = FoodTrackingService.calculate_comprehensive_risk(user_id, days=days)
        
        if not food_risk.get('success'):
            return jsonify({
                'success': True,
                'status': 'success',
                'has_data': False,
                'healthy_defaults': service.get_healthy_defaults()['guidelines']['diet']
            }), 200
        
        daily_analysis = food_risk.get('breakdown', {}).get('daily_analysis', {})
        daily_averages = daily_analysis.get('daily_averages', {})
        
        if not daily_averages:
            return jsonify({
                'success': True,
                'status': 'success',
                'has_data': False,
                'message': 'Insufficient meal data. Log meals to get predictions.',
                'healthy_defaults': service.get_healthy_defaults()['guidelines']['diet']
            }), 200
        
        predictions = service.predict_food_impact(
            avg_glycemic_load=daily_averages.get('glycemic_load', 100),
            avg_fiber_grams=daily_averages.get('fiber', 25),
            avg_added_sugars=daily_averages.get('added_sugars', 25),
            avg_calories=daily_averages.get('calories', 2000),
            duration_days=daily_analysis.get('days_with_data', days),
            baseline_risk_score=food_risk.get('breakdown', {}).get('baseline_risk', 50)
        )
        
        return jsonify({
            'success': True,
            'status': 'success',
            'has_data': True,
            'current_risk_score': food_risk.get('comprehensive_risk_score'),
            'risk_category': food_risk.get('risk_category'),
            'predictions': predictions
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting food predictions: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_sleep_predictions():
    """
    Get sleep-specific timeline predictions.
    
    Response includes timeline predictions based on current sleep patterns.
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        service = get_lifestyle_recommendation_service()
        sleep_service = get_sleep_tracking_service()
        
        sleep_summary = sleep_service.get_sleep_summary(user_id)
        
        if not sleep_summary or not sleep_summary.get('metrics'):
            return jsonify({
                'success': True,
                'status': 'success',
                'has_data': False,
                'message': 'No sleep data available. Start tracking your sleep.',
                'healthy_defaults': service.get_healthy_defaults()['guidelines']['sleep']
            }), 200
        
        metrics = sleep_summary['metrics']
        
        predictions = service.predict_sleep_impact(
            avg_sleep_hours=metrics.get('avg_sleep_7d') or metrics.get('avg_sleep_30d', 7),
            sleep_variability_hours=metrics.get('sleep_variability_30d'),
            bedtime_variability_minutes=metrics.get('bedtime_variability_30d'),
            duration_days=metrics.get('days_with_data_30d', 0)
        )
        
        return jsonify({
            'success': True,
            'status': 'success',
            'has_data': True,
            'current_risk': sleep_summary.get('risk_assessment', {}),
            'predictions': predictions
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting sleep predictions: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_activity_predictions():
    """
    Get activity/step-specific timeline predictions.
    
    Response includes timeline predictions based on current activity patterns.
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        service = get_lifestyle_recommendation_service()
        
        step_metrics = StepTrackingService.compute_metrics(user_id)
        step_baseline = StepBaseline.find_by_user_id(user_id)

        if not step_metrics or step_metrics.get('days_with_data_30d', 0) == 0:
            # Fall back to baseline data if available (mirrors alcohol predictions pattern)
            if not step_baseline:
                return jsonify({
                    'success': True,
                    'status': 'success',
                    'has_data': False,
                    'message': 'No activity data available. Start tracking your steps.',
                    'healthy_defaults': service.get_healthy_defaults()['guidelines']['activity']
                }), 200
            # Use baseline data for predictions
            avg_daily_steps = step_baseline.baseline_avg_daily_steps or 0
            days_active = step_baseline.baseline_days_active_per_week or 0
            # Estimate days_goal_met from days_active_per_week scaled to 30 days
            days_goal_met = round((days_active / 7) * 30)
            duration_days = 30  # treat baseline as representative of ongoing pattern
        else:
            avg_daily_steps = int(step_metrics.get('avg_steps_30d', 0))
            days_goal_met = step_metrics.get('days_met_goal_30d', 0)
            duration_days = step_metrics.get('days_with_data_30d', 0)

        predictions = service.predict_activity_impact(
            avg_daily_steps=avg_daily_steps,
            days_goal_met=days_goal_met,
            duration_days=duration_days
        )

        # Derive risk info for frontend Risk Overview section
        risk_category = None
        current_risk_score = None
        if step_metrics:
            risk_category = step_metrics.get('risk_category')
            current_risk_score = step_metrics.get('risk_score')
        if not risk_category:
            # Fallback: infer from avg_daily_steps when using baseline data
            if avg_daily_steps >= 10000:
                risk_category = 'low'
                current_risk_score = 10
            elif avg_daily_steps >= 7500:
                risk_category = 'low'
                current_risk_score = 20
            elif avg_daily_steps >= 5000:
                risk_category = 'moderate'
                current_risk_score = 40
            elif avg_daily_steps >= 3000:
                risk_category = 'high'
                current_risk_score = 60
            else:
                risk_category = 'very_high'
                current_risk_score = 80

        return jsonify({
            'success': True,
            'status': 'success',
            'has_data': True,
            'risk_category': risk_category,
            'current_risk_score': current_risk_score,
            'avg_steps': avg_daily_steps,
            'predictions': predictions
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting activity predictions: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_alcohol_predictions():
    """
    Get alcohol-specific timeline predictions.
    
    Response includes timeline predictions based on current alcohol consumption patterns.
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        service = get_lifestyle_recommendation_service()
        
        # Get user gender
        user_gender = 'male'
        try:
            user = User.find_by_id(user_id)
            user_gender = (_user_field(user, 'gender', 'male') or 'male').lower()
        except:
            pass
        
        alcohol_metrics = AlcoholMetrics.find_by_user_id(user_id)
        alcohol_baseline = AlcoholBaseline.find_by_user_id(user_id)
        
        if not alcohol_metrics and not alcohol_baseline:
            return jsonify({
                'success': True,
                'status': 'success',
                'has_data': False,
                'message': 'No alcohol data available. Complete the baseline assessment.',
                'healthy_defaults': service.get_healthy_defaults()['guidelines']['alcohol']
            }), 200
        
        if alcohol_metrics:
            drinks_per_week = alcohol_metrics.avg_drinks_per_week_30d or 0
            binge_episodes = alcohol_metrics.binge_episodes_30d or 0
            data_days = alcohol_metrics.days_with_data_30d or 0
            # Supplement with baseline binge frequency when no binge episodes logged yet
            if binge_episodes == 0 and alcohol_baseline:
                binge_episodes = alcohol_baseline.baseline_binge_frequency_per_month or 0
        elif alcohol_baseline:
            drinks_per_week = (alcohol_baseline.baseline_drinking_days_per_week or 0) * \
                              (alcohol_baseline.baseline_drinks_per_occasion or 0)
            binge_episodes = alcohol_baseline.baseline_binge_frequency_per_month or 0
            data_days = 0
        
        predictions = service.predict_alcohol_impact(
            drinks_per_week=drinks_per_week,
            binge_episodes_monthly=binge_episodes,
            duration_days=data_days if data_days > 0 else 30,
            gender=user_gender
        )
        
        # Map risk multiplier to 0-100 score for frontend Risk Overview section
        risk_mult = predictions.get('risk_multiplier', 1.0)
        current_risk_score = min(100, round((risk_mult - 1.0) * 100))

        return jsonify({
            'success': True,
            'status': 'success',
            'has_data': True,
            'risk_category': predictions.get('risk_category'),
            'current_risk_score': current_risk_score,
            'predictions': predictions
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting alcohol predictions: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_smoking_predictions():
    """
    Get smoking-specific timeline predictions.
    
    Response includes timeline predictions based on smoking history.
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        lifestyle_service = get_lifestyle_recommendation_service()
        smoking_service = get_smoking_tracking_service()
        
        # Get baseline from new smoking tracking system
        baseline = smoking_service.get_baseline(user_id)
        
        if not baseline:
            return jsonify({
                'success': True,
                'status': 'success',
                'has_data': False,
                'message': 'No smoking data available. Complete the smoking baseline questionnaire.',
                'healthy_defaults': lifestyle_service.get_healthy_defaults()['guidelines']['smoking']
            }), 200
        
        # Get metrics to calculate pack-years and other data
        metrics = smoking_service.get_metrics(user_id)
        
        # If no metrics yet, compute them
        if not metrics:
            logger.info(f"Computing initial metrics for smoking predictions for user {user_id}")
            metrics = smoking_service.compute_metrics(user_id)
        
        # Extract data for predictions
        smoking_status = baseline.get('smoking_status', 'never')
        pack_years = metrics.get('cumulative_pack_years', 0) if metrics else 0
        years_since_quit = None
        
        # Calculate years since quit for former smokers
        if smoking_status == 'former' and baseline.get('quit_date'):
            from datetime import datetime
            try:
                quit_date = datetime.fromisoformat(baseline['quit_date'])
                years_since_quit = (datetime.utcnow() - quit_date).days / 365.25
            except Exception as e:
                logger.warning(f"Error calculating years since quit: {e}")
        
        # Generate predictions
        predictions = lifestyle_service.predict_smoking_impact(
            smoking_status=smoking_status,
            pack_years=pack_years,
            years_since_quit=years_since_quit
        )
        
        # Map risk multiplier to 0-100 score for frontend Risk Overview section
        risk_mult = predictions.get('risk_multiplier', 1.0)
        current_risk_score = min(100, round((risk_mult - 1.0) * 100))

        return jsonify({
            'success': True,
            'status': 'success',
            'has_data': True,
            'risk_category': predictions.get('risk_category'),
            'current_risk_score': current_risk_score,
            'current_status': smoking_status,
            'pack_years': pack_years,
            'years_since_quit': years_since_quit,
            'predictions': predictions
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting smoking predictions: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_healthy_defaults():
    """
    Get healthy default recommendations for all lifestyle areas.
    
    Returns evidence-based guidelines when user has insufficient tracking data.
    """
    try:
        service = get_lifestyle_recommendation_service()
        defaults = service.get_healthy_defaults()
        
        return jsonify({
            'success': True,
            'status': 'success',
            'data': defaults
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting healthy defaults: {e}", exc_info=True)
        return jsonify({'success': False, 'status': 'error', 'message': 'Internal server error'}), 500
