"""
Comprehensive Diabetes Risk Assessment Service

This service combines all risk factors (initial assessment, lifestyle trackers, 
user biometrics) to generate an overall diabetes risk score with detailed explanations.

See COMPREHENSIVE_DIABETES_RISK_ASSESSMENT.md for full documentation and research references.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import logging
from config.database import get_db
from models.overall_risk_assessment import OverallRiskAssessment, RiskCategory
from models.diabetes_assessment import DiabetesAssessment
from models.user import User
from models.sleep_tracking import SleepMetrics, SleepRiskAssessment
from models.step_tracking import StepMetrics, StepRiskAssessment
from models.smoking_tracking import SmokingMetrics, SmokingRiskAssessment
from models.alcohol_intake import AlcoholMetrics, AlcoholBaseline, AlcoholRiskAssessment, AlcoholRiskCategory
from services.food_tracking_service import FoodTrackingService
from bson import ObjectId

logger = logging.getLogger(__name__)


class ComprehensiveRiskService:
    """Service for computing comprehensive diabetes risk assessment"""
    
    # Component weights (must sum to 1.0)
    # Evidence basis (calibrated for Filipino/Asian populations):
    #   BMI (0.25):              Strongest single T2D predictor; obesity risk near-universal and measurable;
    #                            Yoon et al. (2006) Lancet — epidemic obesity/T2D in Asia.
    #                            Uses WHO Asian cutoffs: overweight ≥23, obese ≥27.5 (WHO Consultation, 2004).
    #   Initial Assessment (0.20): Validated ML model (BRFSS); captures clinical/family-history risk.
    #   Age (0.15):              Risk rises sharply after 45; one of the strongest non-modifiable predictors
    #                            (Bellou et al., 2018 PLOS ONE; IDF Atlas, 2021).
    #   Food (0.18):             Primary modifiable T2D risk factor (Malik et al., 2010 Diabetes Care).
    #   Steps (0.15):            Physical inactivity is a major modifiable risk (Aune et al., 2015).
    #   Alcohol (0.06):          J-shaped relationship with risk.
    #   Smoking (0.00):          Excluded from overall computation for assessment tab (kept for tracking/display).
    #   Sleep (0.00):            Excluded from overall computation for assessment tab (kept for tracking/display).
    #   Sex (0.01):              Small hormonal/metabolic contribution.
    WEIGHTS = {
        'bmi': 0.25,
        'initial_assessment': 0.20,
        'age': 0.15,
        'food': 0.18,
        'steps': 0.15,
        'smoking': 0.00,
        'sleep': 0.00,
        'alcohol': 0.06,
        'sex': 0.01
    }
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def compute_overall_risk(self, user_id: str) -> Dict[str, Any]:
        """
        Compute comprehensive diabetes risk assessment for user.
        
        Args:
            user_id: User identifier
        
        Returns:
            Dict with overall risk assessment
        """
        try:
            # Gather all component data
            components = self._gather_component_data(user_id)
            
            # Calculate component scores
            component_scores = self._calculate_component_scores(components)
            
            # Calculate overall risk score
            overall_score = self._calculate_overall_score(component_scores)
            
            # Classify risk category
            risk_category = OverallRiskAssessment.classify_risk_category(overall_score)
            
            # Determine confidence level
            confidence = self._determine_confidence_level(components)
            
            # Identify primary risk factors
            primary_risks = self._identify_primary_risks(component_scores)
            
            # Identify protective factors
            protective_factors = self._identify_protective_factors(component_scores)
            
            # Generate key improvements
            key_improvements = self._generate_key_improvements(primary_risks, component_scores)
            
            # Generate personalized recommendations
            recommendations = self._generate_recommendations(
                risk_category, primary_risks, component_scores, components
            )
            
            # Generate detailed explanation
            explanation = self._generate_explanation(
                overall_score, risk_category, component_scores, primary_risks, protective_factors
            )
            
            # Generate data quality notes
            data_quality_notes = self._generate_data_quality_notes(components, confidence)
            
            # Create and save assessment
            assessment = OverallRiskAssessment(
                user_id=user_id,
                overall_risk_score=overall_score,
                overall_risk_category=risk_category,
                confidence_level=confidence,
                component_scores=component_scores,
                primary_risk_factors=primary_risks,
                protective_factors=protective_factors,
                key_improvements=key_improvements,
                recommendations=recommendations,
                explanation=explanation,
                data_quality_notes=data_quality_notes
            )
            assessment.save()
            
            self.logger.info(f"Overall risk assessment completed for user {user_id}: {risk_category} ({overall_score:.2f})")
            
            return assessment.to_dict()
            
        except Exception as e:
            self.logger.error(f"Error computing overall risk for user {user_id}: {str(e)}", exc_info=True)
            raise
    
    def _gather_component_data(self, user_id: str) -> Dict[str, Any]:
        """
        Gather all component data for risk assessment.
        
        Note: user_id is the MongoDB ObjectId string (from auth middleware).
        All trackers use this MongoDB ObjectId string, not Firebase UID.
        
        ID Usage:
        - MongoDB ObjectId string (user_id): All queries use this
        """
        db = get_db()
        components = {}
        
        # Get user data (using MongoDB ObjectId)
        user = User.find_by_id(user_id)
        components['user'] = user
        
        if not user:
            self.logger.error(f"User not found with ID: {user_id}")
            return components
        
        # Get initial diabetes assessment (using MongoDB _id as ObjectId)
        assessment_collection = db['diabetes_assessments']
        try:
            initial_assessment = assessment_collection.find_one({'userId': ObjectId(user_id)})
            components['initial_assessment'] = initial_assessment
        except Exception as e:
            self.logger.warning(f"Could not fetch initial assessment: {str(e)}")
            components['initial_assessment'] = None
        
        # Get sleep metrics and risk assessment (using MongoDB ObjectId string)
        sleep_metrics = SleepMetrics.find_by_user_id(user_id)
        sleep_risk = SleepRiskAssessment.find_latest_by_user(user_id) if sleep_metrics else None
        components['sleep'] = sleep_metrics
        components['sleep_risk'] = sleep_risk
        
        # Get step metrics and risk assessment (using MongoDB ObjectId string)
        step_metrics = StepMetrics.find_by_user_id(user_id)
        step_risk = StepRiskAssessment.find_latest_by_user(user_id) if step_metrics else None
        components['steps'] = step_metrics
        components['steps_risk'] = step_risk
        
        # Get smoking metrics and risk assessment (using MongoDB ObjectId string)
        smoking_metrics = SmokingMetrics.find_by_user(user_id)
        smoking_risk = SmokingRiskAssessment.find_latest_by_user(user_id) if smoking_metrics else None
        components['smoking'] = smoking_metrics
        components['smoking_risk'] = smoking_risk
        
        # Get alcohol metrics (using MongoDB ObjectId string)
        alcohol_metrics = AlcoholMetrics.find_by_user_id(user_id)
        components['alcohol'] = alcohol_metrics
        
        # Get food tracking comprehensive risk (using MongoDB ObjectId string)
        try:
            food_risk = FoodTrackingService.calculate_comprehensive_risk(user_id, days=7)
            if food_risk and food_risk.get('success'):
                components['food'] = food_risk
            else:
                components['food'] = None
        except Exception as e:
            self.logger.warning(f"Error fetching food tracking data for user {user_id}: {str(e)}")
            components['food'] = None
        
        return components
    
    def _calculate_component_scores(self, components: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate individual component risk scores"""
        scores = {}
        
        # 1.  Initial Assessment Score (0-100)
        scores['initial_assessment'] = self._score_initial_assessment(
            components.get('initial_assessment')
        )
        
        # 2. Sleep Score (0-100)
        scores['sleep'] = self._score_sleep(
            components.get('sleep'), 
            components.get('sleep_risk')
        )
        
        # 3. Steps Score (0-100)
        scores['steps'] = self._score_steps(
            components.get('steps'), 
            components.get('steps_risk')
        )
        
        # 4. Smoking Score (0-100)
        scores['smoking'] = self._score_smoking(
            components.get('smoking'), 
            components.get('smoking_risk')
        )
        
        # 5. Alcohol Score (-5 to 100, can be negative for protective effect)
        user = components.get('user')
        alcohol_user_id = str(user._id) if user and hasattr(user, '_id') else None
        scores['alcohol'] = self._score_alcohol(components.get('alcohol'), alcohol_user_id)
        
        # 6. Food Score (0-100)
        scores['food'] = self._score_food(components.get('food'))
        
        # 7. BMI Score (0-100)
        scores['bmi'] = self._score_bmi(components.get('user'))
        
        # 8. Age Score (0-100)
        scores['age'] = self._score_age(components.get('user'))
        
        # 9. Sex Score (0-100)
        scores['sex'] = self._score_sex(components.get('user'))
        
        return scores
    
    def _score_initial_assessment(self, assessment: Optional[Dict]) -> Dict[str, Any]:
        """Score initial ML-based diabetes assessment"""
        if not assessment or 'prediction' not in assessment:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['initial_assessment'],
                'status': 'not_completed',
                'details': 'Initial diabetes risk assessment not completed',
                'has_data': False
            }
        
        prediction = assessment['prediction']
        risk_level = prediction.get('risk_level', 'moderate')
        probability = prediction.get('probability', 0.5)
        
        # Convert probability to 0-100 scale
        raw_score = probability * 100
        
        # Map risk level to description
        level_descriptions = {
            'low': 'Low risk based on initial assessment',
            'moderate': 'Moderate risk based on initial assessment',
            'high': 'High risk based on initial assessment'
        }
        
        return {
            'raw_score': round(raw_score, 2),
            'weighted_score': round(raw_score * self.WEIGHTS['initial_assessment'], 2),
            'weight': self.WEIGHTS['initial_assessment'],
            'risk_level': risk_level,
            'probability': round(probability * 100, 2),
            'status': risk_level,
            'details': level_descriptions.get(risk_level, 'Unknown risk level'),
            'has_data': True
        }
    
    def _score_sleep(self, metrics: Optional[Any], risk_assessment: Optional[Any]) -> Dict[str, Any]:
        """Score sleep tracking data using existing risk assessment"""
        if not risk_assessment and not metrics:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['sleep'],
                'status': 'no_data',
                'details': 'Sleep tracking not started',
                'has_data': False
            }
        
        # Use existing risk assessment if available
        if risk_assessment:
            risk_score = getattr(risk_assessment, 'risk_score', 0)
            risk_category = getattr(risk_assessment, 'risk_category', 'unknown')
            
            # Get metrics for details
            avg_sleep = None
            if metrics:
                avg_sleep = getattr(metrics, 'avg_sleep_7d', None) or getattr(metrics, 'avg_sleep_30d', None)
            
            details = f"Average sleep: {avg_sleep:.1f}h/night" if avg_sleep else "Sleep data available"
            
            # Normalize: sleep service scores are confidence-weighted and cap at ~64
            # (very-short sleep + high variability + bad baseline at 30+ days).
            # Dividing by this ceiling rescales to 0-100 so it is comparable to
            # other components (BMI, smoking, etc.) which already use 0-100.
            _SLEEP_SVC_MAX = 64.0
            normalized = round(min(100.0, risk_score * 100.0 / _SLEEP_SVC_MAX), 2)
            return {
                'raw_score': normalized,
                'weighted_score': round(normalized * self.WEIGHTS['sleep'], 2),
                'weight': self.WEIGHTS['sleep'],
                'risk_category': risk_category,
                'avg_sleep_hours': round(avg_sleep, 2) if avg_sleep else None,
                'status': risk_category,
                'details': details,
                'has_data': True
            }
        
        # Fallback to metrics if no risk assessment
        risk_score = getattr(metrics, 'risk_score', 0)
        risk_category = getattr(metrics, 'risk_category', 'unknown')
        avg_sleep = getattr(metrics, 'avg_sleep_7d', None) or getattr(metrics, 'avg_sleep_30d', None)
        
        details = f"Average sleep: {avg_sleep:.1f}h/night" if avg_sleep else "Sleep data available"
        
        _SLEEP_SVC_MAX = 64.0
        normalized = round(min(100.0, risk_score * 100.0 / _SLEEP_SVC_MAX), 2)
        return {
            'raw_score': normalized,
            'weighted_score': round(normalized * self.WEIGHTS['sleep'], 2),
            'weight': self.WEIGHTS['sleep'],
            'risk_category': risk_category,
            'avg_sleep_hours': round(avg_sleep, 2) if avg_sleep else None,
            'status': risk_category,
            'details': details,
            'has_data': True
        }
    
    def _score_steps(self, metrics: Optional[Any], risk_assessment: Optional[Any]) -> Dict[str, Any]:
        """Score physical activity (step tracking) data using existing risk assessment"""
        if not risk_assessment and not metrics:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['steps'],
                'status': 'no_data',
                'details': 'Step tracking not started',
                'has_data': False
            }
        
        # Use existing risk assessment if available
        if risk_assessment:
            risk_score = getattr(risk_assessment, 'risk_score', 0)
            risk_category = getattr(risk_assessment, 'risk_category', 'unknown')
            
            # Get metrics for details
            avg_steps = None
            if metrics:
                avg_steps = getattr(metrics, 'avg_steps_30d', None) or getattr(metrics, 'avg_steps_7d', None)
            
            details = f"Average steps: {int(avg_steps)} steps/day" if avg_steps else "Step data available"
            
            # Normalize: step service scores cap at ~46
            # (very-low penalty 40 × data_weight 0.9 + inconsistency bonus 10).
            # Divide by this ceiling to rescale to 0-100.
            _STEPS_SVC_MAX = 46.0
            normalized = round(min(100.0, risk_score * 100.0 / _STEPS_SVC_MAX), 2)
            return {
                'raw_score': normalized,
                'weighted_score': round(normalized * self.WEIGHTS['steps'], 2),
                'weight': self.WEIGHTS['steps'],
                'risk_category': risk_category,
                'avg_steps_daily': int(avg_steps) if avg_steps else None,
                'status': risk_category,
                'details': details,
                'has_data': True
            }
        
        # Fallback to metrics if no risk assessment
        risk_score = getattr(metrics, 'risk_score', 0)
        risk_category = getattr(metrics, 'risk_category', 'unknown')
        avg_steps = getattr(metrics, 'avg_steps_30d', None) or getattr(metrics, 'avg_steps_7d', None)
        
        details = f"Average steps: {int(avg_steps)} steps/day" if avg_steps else "Step data available"
        
        _STEPS_SVC_MAX = 46.0
        normalized = round(min(100.0, risk_score * 100.0 / _STEPS_SVC_MAX), 2)
        return {
            'raw_score': normalized,
            'weighted_score': round(normalized * self.WEIGHTS['steps'], 2),
            'weight': self.WEIGHTS['steps'],
            'risk_category': risk_category,
            'avg_steps_daily': int(avg_steps) if avg_steps else None,
            'status': risk_category,
            'details': details,
            'has_data': True
        }
    
    def _score_smoking(self, metrics: Optional[Any], risk_assessment: Optional[Any]) -> Dict[str, Any]:
        """Score smoking tracking data using existing risk assessment"""
        if not risk_assessment and not metrics:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['smoking'],
                'status': 'no_data',
                'details': 'Smoking tracking not started',
                'has_data': False
            }
        
        # Use existing risk assessment if available
        if risk_assessment:
            risk_score_raw = getattr(risk_assessment, 'risk_score', 0)
            risk_category = getattr(risk_assessment, 'risk_category', 'unknown')
            
            # Normalize from 1-5 scale to 0-100 scale
            # (1=never/low risk → 0, 5=heavy current smoker → 100)
            raw_score = round(max(0.0, (risk_score_raw - 1) / 4 * 100), 2)
            
            # Get metrics for details
            current_status = None
            if metrics:
                current_status = getattr(metrics, 'current_status', 'unknown')
            
            status_descriptions = {
                'never': 'Never smoker - excellent!',
                'former': 'Former smoker - risk decreasing over time',
                'current': 'Current smoker - significant risk factor'
            }
            
            details = status_descriptions.get(current_status, 'Smoking status tracked')
            
            return {
                'raw_score': raw_score,
                'weighted_score': round(raw_score * self.WEIGHTS['smoking'], 2),
                'weight': self.WEIGHTS['smoking'],
                'risk_category': risk_category,
                'smoking_status': current_status,
                'status': current_status if current_status else risk_category,
                'details': details,
                'has_data': True
            }
        
        # Fallback to metrics if no risk assessment
        risk_score_raw = getattr(metrics, 'risk_score', 1)
        risk_category = getattr(metrics, 'risk_category', 'unknown')
        current_status = getattr(metrics, 'current_status', 'unknown')
        
        # Normalize from 1-5 scale to 0-100 scale
        raw_score = round(max(0.0, (risk_score_raw - 1) / 4 * 100), 2)
        
        status_descriptions = {
            'never': 'Never smoker - excellent!',
            'former': 'Former smoker - risk decreasing over time',
            'current': 'Current smoker - significant risk factor'
        }
        
        details = status_descriptions.get(current_status, 'Smoking status unknown')
        
        return {
            'raw_score': raw_score,
            'weighted_score': round(raw_score * self.WEIGHTS['smoking'], 2),
            'weight': self.WEIGHTS['smoking'],
            'risk_category': risk_category,
            'smoking_status': current_status,
            'status': current_status,
            'details': details,
            'has_data': True
        }
    
    def _score_alcohol(self, metrics: Optional[Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """Score alcohol intake data, falling back to baseline if no daily metrics"""
        # Scores normalized to 0-100 scale so the 8% weight gives a max weighted
        # contribution of 8.0 pts to the overall 0-100 risk score.
        # low (light drinking) is protective: −25 → −2.0 pts to overall
        category_scores = {
            'none': 0,
            'low': -25,   # Protective effect → max −2.0 pts to overall
            'moderate': 25,
            'high': 75,
            'very_high': 100  # Binge drinking → max +8.0 pts to overall
        }
        category_descriptions = {
            'none': 'No alcohol consumption',
            'low': 'Light drinking - may have protective effect',
            'moderate': 'Moderate drinking - slightly elevated risk',
            'high': 'Heavy drinking - significant risk factor',
            'very_high': 'Binge drinking - very high risk'
        }

        # Use daily metrics when enough data is available (>= 7 days logged)
        if metrics and getattr(metrics, 'days_with_data_30d', 0) >= 7:
            risk_category = getattr(metrics, 'risk_category', 'none')
            avg_drinks_week = getattr(metrics, 'avg_drinks_per_week_30d', 0)
            raw_score = category_scores.get(risk_category, 0)
            details = f"{category_descriptions.get(risk_category, 'Unknown')} ({avg_drinks_week:.1f} drinks/week — daily logs)"
            return {
                'raw_score': round(raw_score, 2),
                'weighted_score': round(raw_score * self.WEIGHTS['alcohol'], 2),
                'weight': self.WEIGHTS['alcohol'],
                'risk_category': risk_category,
                'avg_drinks_per_week': round(avg_drinks_week, 2),
                'status': risk_category,
                'details': details,
                'has_data': True
            }

        # Fall back to baseline questionnaire data when daily metrics are absent/insufficient
        user_id = user_id or (getattr(metrics, 'user_id', None) if metrics else None)
        baseline = AlcoholBaseline.find_by_user_id(user_id) if user_id else None

        if not baseline and metrics is None:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['alcohol'],
                'status': 'no_data',
                'details': 'Alcohol tracking not started',
                'has_data': False
            }

        if baseline:
            drinks_per_week = baseline.baseline_drinking_days_per_week * baseline.baseline_drinks_per_occasion
            binge_episodes = baseline.baseline_binge_frequency_per_month
            risk_category, _ = AlcoholMetrics._calculate_risk(
                drinks_per_week, binge_episodes, 0.0,
                baseline.baseline_drinking_days_per_week, None
            )
            raw_score = category_scores.get(risk_category, 0)
            details = f"{category_descriptions.get(risk_category, 'Unknown')} ({drinks_per_week:.1f} drinks/week — baseline)"
            return {
                'raw_score': round(raw_score, 2),
                'weighted_score': round(raw_score * self.WEIGHTS['alcohol'], 2),
                'weight': self.WEIGHTS['alcohol'],
                'risk_category': risk_category,
                'avg_drinks_per_week': round(drinks_per_week, 2),
                'status': risk_category,
                'details': details,
                'has_data': True
            }

        # metrics present but < 7 days — use whatever daily data we have
        risk_category = getattr(metrics, 'risk_category', 'none')
        avg_drinks_week = getattr(metrics, 'avg_drinks_per_week_30d', 0)
        raw_score = category_scores.get(risk_category, 0)
        details = f"{category_descriptions.get(risk_category, 'Unknown')} ({avg_drinks_week:.1f} drinks/week — partial data)"
        return {
            'raw_score': round(raw_score, 2),
            'weighted_score': round(raw_score * self.WEIGHTS['alcohol'], 2),
            'weight': self.WEIGHTS['alcohol'],
            'risk_category': risk_category,
            'avg_drinks_per_week': round(avg_drinks_week, 2),
            'status': risk_category,
            'details': details,
            'has_data': True
        }
    
    def _score_food(self, food_data: Optional[Dict]) -> Dict[str, Any]:
        """Score food intake data from comprehensive risk assessment"""
        if not food_data or not food_data.get('success'):
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['food'],
                'status': 'no_data',
                'details': 'Food tracking not started',
                'has_data': False
            }
        
        # Get comprehensive risk score (0-100)
        raw_score = food_data.get('comprehensive_risk_score', 0)
        risk_category = food_data.get('risk_category', 'Unknown').lower()
        
        # Get breakdown for details
        breakdown = food_data.get('breakdown', {})
        baseline_risk = breakdown.get('baseline_risk', 0)
        daily_log_risk = breakdown.get('daily_log_risk', 0)
        daily_analysis = breakdown.get('daily_analysis', {})
        days_analyzed = daily_analysis.get('days_analyzed', 0)
        
        # Build details string
        if days_analyzed > 0:
            details = f"{risk_category.capitalize()} risk - {days_analyzed} days analyzed (Baseline: {baseline_risk:.1f}%, Daily: {daily_log_risk:.1f}%)"
        else:
            details = f"{risk_category.capitalize()} risk - Based on baseline assessment only"
        
        return {
            'raw_score': round(raw_score, 2),
            'weighted_score': round(raw_score * self.WEIGHTS['food'], 2),
            'weight': self.WEIGHTS['food'],
            'risk_category': risk_category,
            'baseline_risk': round(baseline_risk, 2),
            'daily_log_risk': round(daily_log_risk, 2),
            'days_analyzed': days_analyzed,
            'status': risk_category,
            'details': details,
            'has_data': True
        }
    
    def _score_bmi(self, user: Optional[Any]) -> Dict[str, Any]:
        """Score BMI risk factor"""
        if not user or not user.height or not user.weight:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['bmi'],
                'status': 'no_data',
                'details': 'BMI data not available',
                'has_data': False
            }
        
        # Calculate BMI
        height_m = user.height / 100  # Convert cm to m
        bmi = user.weight / (height_m ** 2)
        
        # Score based on WHO-recommended Asian/Filipino BMI cutoffs (WHO Expert Consultation, 2004):
        #   Normal:              18.5 – 22.9
        #   At Risk (overweight): 23.0 – 27.4
        #   Obese Class I:       27.5 – 32.4
        #   Obese Class II:      ≥ 32.5
        # Normalized to 0-100 so the 25% weight gives max +25.0 pts to overall.
        if bmi < 18.5:
            raw_score = 12
            category = 'underweight'
            details = f"BMI {bmi:.1f} - Underweight"
        elif 18.5 <= bmi < 23.0:
            raw_score = 0
            category = 'normal'
            details = f"BMI {bmi:.1f} - Normal weight (Asian standard)"
        elif 23.0 <= bmi < 27.5:
            raw_score = 25
            category = 'overweight'
            details = f"BMI {bmi:.1f} - Overweight (Asian standard: ≥23)"
        elif 27.5 <= bmi < 32.5:
            raw_score = 60
            category = 'obese_class_1'
            details = f"BMI {bmi:.1f} - Obese Class I (Asian standard: ≥27.5)"
        else:
            raw_score = 100
            category = 'obese_class_2'
            details = f"BMI {bmi:.1f} - Obese Class II (Asian standard: ≥32.5)"
        
        return {
            'raw_score': round(raw_score, 2),
            'weighted_score': round(raw_score * self.WEIGHTS['bmi'], 2),
            'weight': self.WEIGHTS['bmi'],
            'bmi': round(bmi, 1),
            'category': category,
            'status': category,
            'details': details,
            'has_data': True
        }
    
    def _score_age(self, user: Optional[Any]) -> Dict[str, Any]:
        """Score age risk factor"""
        if not user or not user.age:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['age'],
                'status': 'no_data',
                'details': 'Age data not available',
                'has_data': False
            }
        
        age = user.age
        
        # Score based on age ranges
        # Normalized to 0-100 so the 2% weight gives max +2.0 pts to overall.
        if age < 30:
            raw_score = 0
            details = f"Age {age} - Low baseline risk"
        elif 30 <= age < 40:
            raw_score = 13
            details = f"Age {age} - Slightly elevated risk"
        elif 40 <= age < 50:
            raw_score = 33
            details = f"Age {age} - Moderate risk increase"
        elif 50 <= age < 60:
            raw_score = 53
            details = f"Age {age} - Higher risk"
        elif 60 <= age < 70:
            raw_score = 80
            details = f"Age {age} - High risk"
        else:
            raw_score = 100
            details = f"Age {age} - Very high risk"
        
        return {
            'raw_score': round(raw_score, 2),
            'weighted_score': round(raw_score * self.WEIGHTS['age'], 2),
            'weight': self.WEIGHTS['age'],
            'age': age,
            'status': 'age_factor',
            'details': details,
            'has_data': True
        }
    
    def _score_sex(self, user: Optional[Any]) -> Dict[str, Any]:
        """Score sex/gender risk factor"""
        if not user or not user.sex:
            return {
                'raw_score': 0,
                'weighted_score': 0,
                'weight': self.WEIGHTS['sex'],
                'status': 'no_data',
                'details': 'Sex data not available',
                'has_data': False
            }
        
        sex = user.sex.lower()
        
        # Males have slightly higher baseline risk
        # Normalized to 0-100 so the 1% weight gives +1.0 pt max to overall.
        if sex == 'male':
            raw_score = 100
            details = "Male - slightly higher baseline risk"
        else:
            raw_score = 0
            details = "Female - baseline risk"
        
        return {
            'raw_score': round(raw_score, 2),
            'weighted_score': round(raw_score * self.WEIGHTS['sex'], 2),
            'weight': self.WEIGHTS['sex'],
            'sex': sex,
            'status': sex,
            'details': details,
            'has_data': True
        }
    
    def _calculate_overall_score(self, component_scores: Dict[str, Any]) -> float:
        """Calculate weighted overall risk score"""
        total_score = 0
        
        for component, score_info in component_scores.items():
            if score_info['has_data']:
                total_score += score_info['weighted_score']
        
        # Ensure score is between 0 and 100
        return max(0, min(100, total_score))
    
    def _determine_confidence_level(self, components: Dict[str, Any]) -> str:
        """Determine confidence level based on data completeness"""
        has_initial = components.get('initial_assessment') is not None
        
        # Count lifestyle trackers with data
        tracker_count = 0
        tracker_days = 0
        
        for tracker in ['food', 'steps', 'alcohol']:
            if components.get(tracker):
                tracker_count += 1
                # Check if tracker has sufficient data
                if tracker == 'food':
                    try:
                        daily_analysis = components[tracker].get('breakdown', {}).get('daily_analysis', {})
                        days = int(daily_analysis.get('days_with_data', 0))
                    except Exception:
                        days = 0
                elif tracker == 'steps':
                    days = getattr(components[tracker], 'days_with_data_30d', 0)
                elif tracker == 'alcohol':
                    days = getattr(components[tracker], 'days_with_data_30d', 0)
                else:
                    days = 0
                tracker_days = max(tracker_days, days)
        
        # Determine confidence
        if not has_initial:
            return 'preliminary'
        elif tracker_count >= 3 and tracker_days >= 30:
            return 'high'
        elif tracker_count >= 2 and tracker_days >= 7:
            return 'moderate'
        elif has_initial:
            return 'low'
        else:
            return 'preliminary'
    
    def _format_component_name(self, component: str) -> str:
        """Format component key into readable name"""
        component_names = {
            'initial_assessment': 'Initial Risk Assessment',
            'sleep': 'Sleep Quality',
            'steps': 'Physical Activity',
            'smoking': 'Smoking Status',
            'alcohol': 'Alcohol Consumption',
            'food': 'Diet & Nutrition',
            'bmi': 'Body Mass Index',
            'age': 'Age Factor',
            'sex': 'Gender Factor'
        }
        return component_names.get(component, component.replace('_', ' ').title())
    
    def _identify_primary_risks(self, component_scores: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Return ALL tracked components sorted by weighted contribution (highest risk first)."""
        risks = []
        
        for component, score_info in component_scores.items():
            if score_info['has_data']:  # include all tracked components, even 0-score ones
                risks.append({
                    'component': component,
                    'component_name': self._format_component_name(component),
                    'weighted_score': score_info['weighted_score'],
                    'raw_score': score_info['raw_score'],
                    'weight_percentage': int(score_info['weight'] * 100),
                    'details': score_info['details'],
                    'status': score_info['status']
                })
        
        # Sort by weighted score descending (positive/risk first, neutral 0 next, protective negative last)
        risks.sort(key=lambda x: x['weighted_score'], reverse=True)
        
        return risks  # no cap — all tracked components are shown
    
    def _identify_protective_factors(self, component_scores: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify protective factors (genuinely negative-score components only).
        Zero-score neutral components are included in primary_risk_factors sorted to the end.
        """
        protective = []
        
        for component, score_info in component_scores.items():
            if score_info['has_data'] and score_info['weighted_score'] < 0:
                protective.append({
                    'component': component,
                    'component_name': self._format_component_name(component),
                    'weighted_score': abs(score_info['weighted_score']),
                    'details': score_info['details']
                })
        
        return protective
    
    def _generate_key_improvements(
        self, 
        primary_risks: List[Dict[str, Any]], 
        component_scores: Dict[str, Any]
    ) -> List[str]:
        """Generate top 3 areas for improvement"""
        improvements = []
        
        # Take top 3 modifiable risk factors
        modifiable_components = ['sleep', 'steps', 'smoking', 'alcohol', 'food', 'bmi']
        
        for risk in primary_risks:
            component = risk['component']
            if component in modifiable_components and len(improvements) < 3:
                improvement_texts = {
                    'sleep': 'Improve sleep duration and consistency (aim for 7-8 hours nightly)',
                    'steps': 'Increase daily physical activity (target 7,000-10,000 steps)',
                    'smoking': 'Quit smoking or continue abstinence',
                    'alcohol': 'Reduce alcohol consumption or maintain moderate intake',
                    'food': 'Improve diet quality (reduce sugars, increase fiber)',
                    'bmi': 'Achieve healthy weight through diet and exercise'
                }
                
                if component in improvement_texts:
                    improvements.append(improvement_texts[component])
        
        # If fewer than 3, add general recommendations
        while len(improvements) < 3:
            general_recs = [
                'Maintain regular health check-ups',
                'Monitor blood glucose levels',
                'Stay physically active',
                'Eat a balanced diet',
                'Manage stress effectively'
            ]
            for rec in general_recs:
                if rec not in improvements and len(improvements) < 3:
                    improvements.append(rec)
        
        return improvements[:3]
    
    def _generate_recommendations(
        self,
        risk_category: str,
        primary_risks: List[Dict[str, Any]],
        component_scores: Dict[str, Any],
        components: Dict[str, Any]
    ) -> List[str]:
        """Generate personalized recommendations"""
        recommendations = []
        
        # Category-specific general recommendations
        if risk_category == RiskCategory.VERY_HIGH or risk_category == RiskCategory.HIGH:
            recommendations.append("🏥 Consult with a healthcare provider immediately to discuss diabetes prevention strategies.")
            recommendations.append("📊 Schedule regular blood glucose monitoring and HbA1c tests.")
        
        # Component-specific recommendations (all primary risks, prioritised by score)
        for risk in primary_risks:
            component = risk['component']
            
            if component == 'sleep' and risk['weighted_score'] > 1:
                recommendations.append("😴 Establish consistent sleep schedule: aim for 7-8 hours nightly with regular bedtime.")
            
            if component == 'steps' and risk['weighted_score'] > 1:
                recommendations.append("🚶 Increase daily activity: target 10,000 steps/day or at least 150 minutes of moderate exercise weekly.")
            
            if component == 'smoking' and risk['status'] == 'current':
                recommendations.append("🚭 Quit smoking: consult healthcare provider about cessation programs and nicotine replacement therapy.")
            
            if component == 'alcohol' and risk['weighted_score'] > 1:
                recommendations.append("🍷 Reduce alcohol intake: limit to ≤7 drinks/week, avoid binge drinking, drink with meals.")
            
            if component == 'bmi' and risk['raw_score'] >= 10:
                recommendations.append("⚖️ Achieve healthy weight: set realistic weight loss goals (5-10% of body weight can significantly reduce risk).")
            
            if component == 'food' and risk['weighted_score'] > 1:
                recommendations.append("🥗 Improve diet: reduce added sugars and refined carbs, increase fiber intake (25g+/day).")
        
        # General lifestyle recommendations
        recommendations.append("📱 Continue tracking your health data to monitor progress over time.")
        recommendations.append("💪 Join diabetes prevention programs (DPP) if available in your area.")
        
        # Limit to 7-8 recommendations
        return recommendations[:8]
    
    def _generate_explanation(
        self,
        overall_score: float,
        risk_category: str,
        component_scores: Dict[str, Any],
        primary_risks: List[Dict[str, Any]],
        protective_factors: List[Dict[str, Any]]
    ) -> str:
        """Generate detailed explanation of risk score"""
        
        category_info = OverallRiskAssessment.get_risk_category_info(risk_category)
        
        explanation_parts = [
            f"Your overall diabetes risk score is {overall_score:.1f}/100, indicating {category_info['title']}.",
            f"",
            f"This assessment is based on {len([s for s in component_scores.values() if s['has_data']])} data sources with weighted contributions:",
            f""
        ]
        
        # List primary risk factors
        if primary_risks:
            explanation_parts.append("**Primary Risk Factors:**")
            for i, risk in enumerate(primary_risks[:5], 1):
                component_name = risk.get('component_name', risk['component'].replace('_', ' ').title())
                explanation_parts.append(
                    f"{i}. {component_name}: +{risk['weighted_score']:.1f} points ({risk['weight_percentage']}% weight) - {risk['details']}"
                )
            explanation_parts.append("")
        
        # List protective factors
        if protective_factors:
            explanation_parts.append("**Protective Factors:**")
            for i, factor in enumerate(protective_factors, 1):
                component_name = factor.get('component_name', factor['component'].replace('_', ' ').title())
                if factor['weighted_score'] > 0:
                    explanation_parts.append(f"• {component_name}: -{factor['weighted_score']:.1f} points - {factor['details']}")
                else:
                    explanation_parts.append(f"• {component_name}: {factor['details']}")
            explanation_parts.append("")
        
        # Summary interpretation
        explanation_parts.append(f"**Risk Interpretation:** {category_info['message']}")
        explanation_parts.append(f"**Probability:** {category_info['probability']}")
        
        return "\n".join(explanation_parts)
    
    def _generate_data_quality_notes(self, components: Dict[str, Any], confidence: str) -> str:
        """Generate notes about data quality and completeness"""
        notes = []
        
        notes.append(f"Assessment confidence: {confidence.upper()}")
        
        # Check what data is available
        has_data = []
        missing_data = []
        
        data_sources = {
            'initial_assessment': 'Initial Risk Assessment',
            'sleep': 'Sleep Tracking',
            'steps': 'Step Tracking',
            'smoking': 'Smoking History',
            'alcohol': 'Alcohol Intake',
            'food': 'Food Tracking'
        }
        
        for key, name in data_sources.items():
            if components.get(key):
                has_data.append(name)
            else:
                missing_data.append(name)
        
        # Check user data (BMI, Age, Sex) separately
        user = components.get('user')
        if not user or not user.height or not user.weight:
            missing_data.append('BMI Data')
        else:
            has_data.append('BMI Data')
        
        if not user or not user.age:
            missing_data.append('Age')
        else:
            has_data.append('Age')
        
        if not user or not user.sex:
            missing_data.append('Sex/Gender')
        else:
            has_data.append('Sex/Gender')
        
        if missing_data:
            notes.append(f"\nMissing data sources: {', '.join(missing_data)}")
            notes.append("Complete all health trackers for most accurate assessment.")
        
        if confidence == 'preliminary' or confidence == 'low':
            notes.append("\n⚠️ Limited data available. Assessment will become more accurate as you track more data over time.")
        
        return "\n".join(notes)
    
    def get_assessment(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get existing assessment or compute new one; refresh if stale (>1 hour)"""
        assessment = OverallRiskAssessment.find_by_user_id(user_id)

        if assessment:
            age = datetime.utcnow() - assessment.updated_at
            if age.total_seconds() < 3600:  # 1-hour TTL
                return assessment.to_dict()

        # Compute new assessment (no record yet, or record is stale)
        return self.compute_overall_risk(user_id)
    
    def refresh_assessment(self, user_id: str) -> Dict[str, Any]:
        """Force refresh of risk assessment"""
        return self.compute_overall_risk(user_id)

    # ==================== TREND PREDICTION ====================

    def compute_trend_prediction(self, user_id: str) -> Dict[str, Any]:
        """
        Predict whether the user's overall health status is likely to improve or decline.

        Uses current lifestyle component data to evaluate trajectories:
        - Sleep: recent 7-day vs 30-day average
        - Steps: recent 7-day vs 30-day average
        - Smoking: current status trajectory
        - Alcohol: consumption pattern
        - Food: recent daily risk vs baseline risk
        - BMI: current category as static anchor

        Returns:
            Dict with prediction status, forecast scores, component trends,
            and driving factors.
        """
        try:
            # Gather current component data
            components = self._gather_component_data(user_id)
            component_scores = self._calculate_component_scores(components)

            # Get current assessment for baseline score
            current_assessment = OverallRiskAssessment.find_by_user_id(user_id)
            current_score = current_assessment.overall_risk_score if current_assessment else None

            if current_score is None:
                # Compute it inline if not saved yet
                current_score = self._calculate_overall_score(component_scores)

            # Analyse per-component trends
            component_trends = self._analyse_component_trends(components, component_scores)

            # Aggregate into an overall trajectory score
            # +100 = fully improving, -100 = fully declining, 0 = stable
            trajectory_score = self._compute_trajectory_score(component_trends)

            # Determine status label
            if trajectory_score >= 8:
                status = 'improving'
            elif trajectory_score <= -8:
                status = 'declining'
            else:
                status = 'stable'

            # Forecast future scores  (conservative linear projection)
            change_per_30d = self._estimate_score_change_per_30d(trajectory_score, current_score)
            change_per_90d = change_per_30d * 2.5  # non-linear dampening for 90-day

            forecast_30d_score = round(max(0, min(100, current_score + change_per_30d)), 1)
            forecast_90d_score = round(max(0, min(100, current_score + change_per_90d)), 1)

            forecast_30d_cat = OverallRiskAssessment.classify_risk_category(forecast_30d_score)
            forecast_90d_cat = OverallRiskAssessment.classify_risk_category(forecast_90d_score)

            # Build per-horizon explanations
            forecast_30d_explanation = self._build_forecast_explanation(
                change_per_30d, component_trends, 30
            )
            forecast_90d_explanation = self._build_forecast_explanation(
                change_per_90d, component_trends, 90
            )

            # Identify driving factors
            driving_factors = self._identify_driving_factors(component_trends)

            # Determine prediction confidence
            confidence = self._prediction_confidence(components, component_trends)

            # Human-readable message
            trend_message = self._build_trend_message(status, trajectory_score, change_per_30d, component_trends)

            return {
                'status': status,
                'trajectory_score': round(trajectory_score, 1),
                'current_risk_score': current_score,
                'current_risk_category': OverallRiskAssessment.classify_risk_category(current_score),
                'forecast': {
                    'days_30': {
                        'predicted_score': forecast_30d_score,
                        'predicted_change': round(change_per_30d, 1),
                        'predicted_category': forecast_30d_cat,
                        'category_info': OverallRiskAssessment.get_risk_category_info(forecast_30d_cat),
                        'explanation': forecast_30d_explanation,
                    },
                    'days_90': {
                        'predicted_score': forecast_90d_score,
                        'predicted_change': round(change_per_90d, 1),
                        'predicted_category': forecast_90d_cat,
                        'category_info': OverallRiskAssessment.get_risk_category_info(forecast_90d_cat),
                        'explanation': forecast_90d_explanation,
                    }
                },
                'component_trends': component_trends,
                'driving_factors': driving_factors,
                'trend_message': trend_message,
                'prediction_basis': 'lifestyle_analysis',
                'confidence': confidence
            }

        except Exception as e:
            self.logger.error(f"Error computing trend prediction for user {user_id}: {str(e)}", exc_info=True)
            raise

    # ---------- helpers for trend prediction ----------

    def _analyse_component_trends(
        self, components: Dict[str, Any], component_scores: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyse each modifiable component for improving/declining/stable trend."""
        trends = {}

        # --- Sleep ---
        sleep_metrics = components.get('sleep')
        if sleep_metrics:
            avg_7d = getattr(sleep_metrics, 'avg_sleep_7d', None)
            avg_30d = getattr(sleep_metrics, 'avg_sleep_30d', None)
            variability_7d = getattr(sleep_metrics, 'sleep_variability_7d', None)
            variability_30d = getattr(sleep_metrics, 'sleep_variability_30d', None)

            direction = 'stable'
            description = 'Sleep pattern is stable'
            change = 0.0

            if avg_7d is not None and avg_30d is not None and avg_30d > 0:
                diff = avg_7d - avg_30d
                change = round(diff, 2)
                if diff > 0.5:
                    direction = 'improving'
                    description = f'Recent sleep improved (+{diff:.1f}h over 30-day avg)'
                elif diff < -0.5:
                    direction = 'declining'
                    description = f'Recent sleep declined ({diff:.1f}h vs 30-day avg)'
                else:
                    # Check if current avg is in optimal range
                    if 7.0 <= avg_7d <= 8.5:
                        direction = 'stable'
                        description = f'Sleep is consistently healthy ({avg_7d:.1f}h)'
                    elif avg_7d < 6.0:
                        direction = 'declining'
                        description = f'Chronic short sleep ({avg_7d:.1f}h) increases risk'
                    else:
                        direction = 'stable'
                        description = f'Sleep averaging {avg_7d:.1f}h (target 7-8h)'

                # Bonus: if variability is also improving, strengthen signal
                if (variability_7d is not None and variability_30d is not None
                        and variability_30d > 0 and variability_7d < variability_30d * 0.8):
                    if direction == 'stable':
                        direction = 'improving'
                        description += ' with improved consistency'

            trends['sleep'] = {
                'direction': direction,
                'current_score': component_scores.get('sleep', {}).get('raw_score', 0),
                'change': change,
                'description': description,
                'has_data': sleep_metrics is not None
            }
        else:
            trends['sleep'] = {
                'direction': 'no_data',
                'current_score': 0,
                'change': 0,
                'description': 'Sleep tracking not started',
                'has_data': False
            }

        # --- Steps / Physical Activity ---
        step_metrics = components.get('steps')
        if step_metrics:
            avg_steps_7d = getattr(step_metrics, 'avg_steps_7d', None)
            avg_steps_30d = getattr(step_metrics, 'avg_steps_30d', None)

            direction = 'stable'
            description = 'Activity level is stable'
            change = 0.0

            if avg_steps_7d is not None and avg_steps_30d is not None and avg_steps_30d > 0:
                ratio = avg_steps_7d / avg_steps_30d
                change = round(avg_steps_7d - avg_steps_30d, 0)
                if ratio >= 1.10:
                    direction = 'improving'
                    description = f'Activity increased (+{int(change)} steps vs 30-day avg)'
                elif ratio <= 0.90:
                    direction = 'declining'
                    description = f'Activity decreased ({int(change)} steps vs 30-day avg)'
                else:
                    if avg_steps_7d >= 10000:
                        direction = 'stable'
                        description = f'Consistently active ({int(avg_steps_7d):,} steps/day)'
                    elif avg_steps_7d < 5000:
                        direction = 'declining'
                        description = f'Low activity level ({int(avg_steps_7d):,} steps/day)'
                    else:
                        direction = 'stable'
                        description = f'Moderate activity ({int(avg_steps_7d):,} steps/day)'

            trends['steps'] = {
                'direction': direction,
                'current_score': component_scores.get('steps', {}).get('raw_score', 0),
                'change': change,
                'description': description,
                'has_data': True
            }
        else:
            trends['steps'] = {
                'direction': 'no_data',
                'current_score': 0,
                'change': 0,
                'description': 'Step tracking not started',
                'has_data': False
            }

        # --- Smoking ---
        smoking_metrics = components.get('smoking')
        if smoking_metrics:
            current_status = getattr(smoking_metrics, 'current_status', 'unknown')
            quit_duration_days = getattr(smoking_metrics, 'quit_duration_days', 0) or 0

            if current_status == 'never':
                direction = 'stable'
                description = 'Non-smoker – no smoking risk'
                change = 0.0
            elif current_status == 'current':
                direction = 'declining'
                description = 'Active smoking continues to elevate diabetes risk'
                change = -5.0
            elif current_status == 'former':
                if quit_duration_days >= 365:
                    direction = 'improving'
                    years = quit_duration_days / 365
                    description = f'Quit {years:.1f} yr(s) ago – risk steadily decreasing'
                    change = min(3.0, quit_duration_days / 365)
                else:
                    months = quit_duration_days / 30
                    direction = 'improving'
                    description = f'Quit {months:.0f} month(s) ago – risk will decrease over time'
                    change = 1.0
            else:
                direction = 'stable'
                description = 'Smoking status tracked'
                change = 0.0

            trends['smoking'] = {
                'direction': direction,
                'current_score': component_scores.get('smoking', {}).get('raw_score', 0),
                'change': change,
                'description': description,
                'has_data': True
            }
        else:
            trends['smoking'] = {
                'direction': 'no_data',
                'current_score': 0,
                'change': 0,
                'description': 'Smoking tracking not started',
                'has_data': False
            }

        # --- Alcohol ---
        alcohol_metrics = components.get('alcohol')
        if alcohol_metrics:
            risk_category = getattr(alcohol_metrics, 'risk_category', 'none')
            avg_drinks_week = getattr(alcohol_metrics, 'avg_drinks_per_week_30d', 0) or 0

            # Alcohol trend direction based on risk category
            if risk_category in ('none', 'low'):
                direction = 'stable'
                description = 'Low alcohol consumption – within healthy range'
                change = 0.0
            elif risk_category == 'moderate':
                direction = 'stable'
                description = f'Moderate drinking ({avg_drinks_week:.1f} drinks/week) – some risk'
                change = -1.0
            else:
                direction = 'declining'
                description = f'Heavy alcohol use ({avg_drinks_week:.1f} drinks/week) – elevated risk'
                change = -3.0

            trends['alcohol'] = {
                'direction': direction,
                'current_score': component_scores.get('alcohol', {}).get('raw_score', 0),
                'change': change,
                'description': description,
                'has_data': True
            }
        else:
            trends['alcohol'] = {
                'direction': 'no_data',
                'current_score': 0,
                'change': 0,
                'description': 'Alcohol tracking not started',
                'has_data': False
            }

        # --- Food / Diet ---
        food_data = components.get('food')
        if food_data and food_data.get('success'):
            baseline_risk = food_data.get('breakdown', {}).get('baseline_risk', 0) or 0
            daily_log_risk = food_data.get('breakdown', {}).get('daily_log_risk', 0) or 0
            days_analyzed = food_data.get('breakdown', {}).get('daily_analysis', {}).get('days_analyzed', 0) or 0

            direction = 'stable'
            description = 'Dietary pattern is stable'
            change = 0.0

            if days_analyzed > 0:
                diff = daily_log_risk - baseline_risk
                change = round(-diff, 1)  # negative diff = improving
                if diff < -5:
                    direction = 'improving'
                    description = f'Recent diet better than baseline (risk ↓{abs(diff):.0f}%)'
                elif diff > 5:
                    direction = 'declining'
                    description = f'Recent diet worse than baseline (risk ↑{diff:.0f}%)'
                else:
                    risk_score = food_data.get('comprehensive_risk_score', 50)
                    if risk_score < 30:
                        direction = 'stable'
                        description = 'Diet quality is good and consistent'
                    elif risk_score > 60:
                        direction = 'declining'
                        description = 'High dietary risk – reduce sugars and refined carbs'
                    else:
                        direction = 'stable'
                        description = 'Dietary risk is moderate and stable'
            else:
                description = 'Diet tracked only via baseline questionnaire'

            trends['food'] = {
                'direction': direction,
                'current_score': component_scores.get('food', {}).get('raw_score', 0),
                'change': change,
                'description': description,
                'has_data': True
            }
        else:
            trends['food'] = {
                'direction': 'no_data',
                'current_score': 0,
                'change': 0,
                'description': 'Food tracking not started',
                'has_data': False
            }

        return trends

    def _compute_trajectory_score(self, component_trends: Dict[str, Any]) -> float:
        """
        Aggregate component trends into a single trajectory score.
        Positive = improving (risk decreasing), Negative = declining.
        Range: -100 to +100
        """
        # Weights proportional to the modifiable-factor slice of WEIGHTS:
        #   food=0.12, steps=0.10, smoking=0.07, sleep=0.06, alcohol=0.04 → total 0.39
        #   Normalised: food=0.31, steps=0.26, smoking=0.18, sleep=0.15, alcohol=0.10
        component_weights = {
            'food':    0.31,
            'steps':   0.26,
            'smoking': 0.18,
            'sleep':   0.15,
            'alcohol': 0.10,
        }
        direction_values = {
            'improving': 1.0,
            'stable':    0.0,
            'declining': -1.0,
            'no_data':   0.0
        }

        total_weight = 0.0
        weighted_sum = 0.0

        for component, weight in component_weights.items():
            trend = component_trends.get(component, {})
            direction = trend.get('direction', 'no_data')
            if direction == 'no_data':
                continue  # Skip absent trackers
            val = direction_values.get(direction, 0.0)
            weighted_sum += val * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        # Normalised score from -100 to +100
        return round((weighted_sum / total_weight) * 100, 1)

    def _estimate_score_change_per_30d(self, trajectory_score: float, current_score: float) -> float:
        """
        Estimate expected risk score change over 30 days.
        Conservative: max ±8 points per 30 days at full trajectory.
        Dampened further if already at extreme ends of the scale.
        """
        max_change = 8.0  # Maximum absolute change in 30 days

        # Scale trajectory (-100 to +100) to change (-8 to +8)
        # NOTE: positive trajectory = improving = score DECREASES
        raw_change = -(trajectory_score / 100) * max_change

        # Dampen change when score is near the boundary it would cross.
        # Dividing by 100 keeps the factor in [0, 1] so we never amplify.
        if raw_change < 0:  # score will decrease (improving → towards 0)
            dampen = min(1.0, current_score / 100)  # approaches 0 as score → 0
            return round(raw_change * dampen, 2)
        else:  # score will increase (declining → towards 100)
            headroom = min(1.0, (100 - current_score) / 100)  # approaches 0 as score → 100
            return round(raw_change * headroom, 2)

    def _identify_driving_factors(self, component_trends: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify key factors driving the overall prediction."""
        factors = []

        for component, trend in component_trends.items():
            direction = trend.get('direction', 'no_data')
            if direction not in ('improving', 'declining'):
                continue
            factors.append({
                'factor': component,
                'factor_name': self._format_component_name(component),
                'impact': 'positive' if direction == 'improving' else 'negative',
                'direction': direction,
                'description': trend.get('description', '')
            })

        # Sort: declining first (most urgent), then improving
        factors.sort(key=lambda x: 0 if x['impact'] == 'negative' else 1)
        return factors[:5]

    def _prediction_confidence(
        self, components: Dict[str, Any], component_trends: Dict[str, Any]
    ) -> str:
        """Determine prediction confidence based on data availability."""
        trackers_with_data = sum(
            1 for k in ('sleep', 'steps', 'smoking', 'alcohol', 'food')
            if component_trends.get(k, {}).get('has_data', False)
        )
        if trackers_with_data >= 4:
            return 'high'
        elif trackers_with_data >= 2:
            return 'moderate'
        return 'low'

    def _build_forecast_explanation(
        self, change: float, component_trends: Dict[str, Any], days: int
    ) -> str:
        """
        One-sentence explanation of what is driving the forecast score for a given horizon.
        Tells the user WHY the predicted value is higher or lower than their current score.
        """
        label_map = {
            'sleep': 'Sleep', 'steps': 'Activity',
            'smoking': 'Smoking', 'alcohol': 'Alcohol', 'food': 'Diet',
        }
        improving = [
            label_map.get(k, k) for k, v in component_trends.items()
            if v.get('direction') == 'improving' and v.get('has_data')
        ]
        declining = [
            label_map.get(k, k) for k, v in component_trends.items()
            if v.get('direction') == 'declining' and v.get('has_data')
        ]

        abs_change = abs(round(change, 1))
        uncertainty = ' (estimate)' if days >= 90 else ''

        if not improving and not declining:
            return (
                f"All tracked lifestyle factors are stable — "
                f"no significant score change expected over {days} days."
            )

        direction_word = 'decrease' if change < 0 else 'increase'
        parts = []
        if improving:
            names = ', '.join(improving[:2])
            verb = 'are' if len(improving) > 1 else 'is'
            parts.append(f"{names} {verb} improving")
        if declining:
            names = ', '.join(declining[:2])
            verb = 'are' if len(declining) > 1 else 'is'
            parts.append(f"{names} {verb} declining")

        basis = ' while '.join(parts)
        return (
            f"{basis.capitalize()} — "
            f"risk score projected to {direction_word} by ~{abs_change} pts "
            f"in {days} days{uncertainty}."
        )

    def _build_trend_message(
        self,
        status: str,
        trajectory_score: float,
        change_per_30d: float,
        component_trends: Dict[str, Any]
    ) -> str:
        """Generate a human-readable prediction message."""
        abs_change = abs(change_per_30d)

        if status == 'improving':
            if abs_change >= 4:
                return (
                    "Your health trajectory is strongly improving. "
                    "Your current lifestyle changes are making a meaningful impact on your diabetes risk."
                )
            return (
                "Your health trajectory is improving. "
                "Keep up your current habits to continue reducing your diabetes risk."
            )
        elif status == 'declining':
            declining = [
                v.get('description', '')
                for v in component_trends.values()
                if v.get('direction') == 'declining'
            ]
            focus = declining[0] if declining else 'your lifestyle habits'
            if abs_change >= 4:
                return (
                    f"Your diabetes risk is significantly increasing. "
                    f"Urgent attention needed: {focus}."
                )
            return (
                f"Your diabetes risk is trending upward. "
                f"Addressing key areas – such as {focus} – can reverse this trend."
            )
        else:
            return (
                "Your diabetes risk is currently stable. "
                "Small improvements to sleep, activity, or diet can shift the trajectory in your favour."
            )


# Global service instance
_comprehensive_risk_service = None


def get_comprehensive_risk_service() -> ComprehensiveRiskService:
    """Get or create the global comprehensive risk service"""
    global _comprehensive_risk_service
    if _comprehensive_risk_service is None:
        _comprehensive_risk_service = ComprehensiveRiskService()
    return _comprehensive_risk_service
