from datetime import datetime, timedelta
from models.step_tracking import StepBaseline, StepMetrics, StepRiskAssessment
from models.user_activity import UserActivity
from config.database import get_db
from statistics import mean, stdev
import logging

class StepTrackingService:
    """Service for step tracking risk assessment - follows sleep_tracking_service.py pattern"""
    
    DAILY_STEP_GOAL = 10000
    SEDENTARY_THRESHOLD = 5000
    
    @staticmethod
    def compute_metrics(user_id):
        """Compute step metrics from daily activity records"""
        try:
            db = get_db()
            user_activity = UserActivity(db)
            
            today = datetime.utcnow().date()
            date_7d = (today - timedelta(days=7)).strftime('%Y-%m-%d')
            date_30d = (today - timedelta(days=30)).strftime('%Y-%m-%d')
            
            # Get records from user_activity collection
            records_7d = user_activity.get_activity_by_date_range(
                user_id,
                date_7d,
                today.strftime('%Y-%m-%d')
            )
            
            records_30d = user_activity.get_activity_by_date_range(
                user_id,
                date_30d,
                today.strftime('%Y-%m-%d')
            )
            
            # Get baseline
            baseline = StepBaseline.find_by_user_id(user_id)
            
            # Initialize metrics data
            metrics_data = {
                'user_id': user_id,
                'computed_at': datetime.utcnow()
            }
            
            # 7-day metrics
            if records_7d and len(records_7d) > 0:
                steps_7d = [r.get('steps', 0) for r in records_7d if r.get('steps')]
                if steps_7d:
                    metrics_data['avg_steps_7d'] = mean(steps_7d)
                    metrics_data['days_with_data_7d'] = len(steps_7d)
                    metrics_data['days_met_goal_7d'] = sum(1 for s in steps_7d if s >= StepTrackingService.DAILY_STEP_GOAL)
                else:
                    metrics_data['avg_steps_7d'] = baseline.baseline_avg_daily_steps if baseline else 0
                    metrics_data['days_with_data_7d'] = 0
                    metrics_data['days_met_goal_7d'] = 0
            else:
                metrics_data['avg_steps_7d'] = baseline.baseline_avg_daily_steps if baseline else 0
                metrics_data['days_with_data_7d'] = 0
                metrics_data['days_met_goal_7d'] = 0
            
            # 30-day metrics
            if records_30d and len(records_30d) > 0:
                steps_30d = [r.get('steps', 0) for r in records_30d if r.get('steps')]
                if steps_30d:
                    metrics_data['avg_steps_30d'] = mean(steps_30d)
                    metrics_data['days_with_data_30d'] = len(steps_30d)
                    metrics_data['days_met_goal_30d'] = sum(1 for s in steps_30d if s >= StepTrackingService.DAILY_STEP_GOAL)
                    
                    # Variability
                    if len(steps_30d) >= 2:
                        metrics_data['step_variability_30d'] = stdev(steps_30d)
                    else:
                        metrics_data['step_variability_30d'] = 0
                else:
                    metrics_data['avg_steps_30d'] = baseline.baseline_avg_daily_steps if baseline else 0
                    metrics_data['days_with_data_30d'] = 0
                    metrics_data['days_met_goal_30d'] = 0
                    metrics_data['step_variability_30d'] = 0
            else:
                metrics_data['avg_steps_30d'] = baseline.baseline_avg_daily_steps if baseline else 0
                metrics_data['days_with_data_30d'] = 0
                metrics_data['days_met_goal_30d'] = 0
                metrics_data['step_variability_30d'] = 0
            
            # Active days
            metrics_data['active_days_7d'] = metrics_data['days_with_data_7d']
            metrics_data['active_days_30d'] = metrics_data['days_with_data_30d']
            
            # Source tracking (all from user_activity = health_connect)
            if metrics_data['days_with_data_30d'] > 0:
                metrics_data['dominant_source'] = 'health_connect'
            else:
                metrics_data['dominant_source'] = 'baseline_only'
            
            # Risk assessment
            risk_result = StepTrackingService.assess_risk(user_id, metrics_data, baseline)
            metrics_data.update(risk_result)
            
            # Save metrics
            metrics = StepMetrics(
                user_id=user_id,
                avg_steps_7d=metrics_data.get('avg_steps_7d'),
                avg_steps_30d=metrics_data.get('avg_steps_30d'),
                active_days_7d=metrics_data.get('active_days_7d'),
                active_days_30d=metrics_data.get('active_days_30d'),
                step_variability_30d=metrics_data.get('step_variability_30d'),
                days_met_goal_7d=metrics_data.get('days_met_goal_7d'),
                days_met_goal_30d=metrics_data.get('days_met_goal_30d'),
                dominant_source=metrics_data.get('dominant_source'),
                days_with_data_7d=metrics_data.get('days_with_data_7d'),
                days_with_data_30d=metrics_data.get('days_with_data_30d'),
                risk_category=metrics_data.get('risk_category'),
                risk_score=metrics_data.get('risk_score'),
                risk_factors=metrics_data.get('risk_factors', [])
            )
            metrics.save()
            
            return metrics_data
            
        except Exception as e:
            logging.error(f"Error computing step metrics: {str(e)}")
            raise
    
    @staticmethod
    def assess_risk(user_id, metrics, baseline):
        """Assess diabetes risk based on step activity"""
        risk_score = 0
        risk_factors = []
        recommendations = []
        
        avg_steps = metrics.get('avg_steps_30d', 0)
        days_tracked = metrics.get('days_with_data_30d', 0)
        
        # Confidence weighting (similar to sleep tracking)
        if days_tracked < 7:
            confidence = 'preliminary'
            data_weight = 0.3
        elif days_tracked < 14:
            confidence = 'moderate'
            data_weight = 0.5
        elif days_tracked < 30:
            confidence = 'good'
            data_weight = 0.75
        else:
            confidence = 'high'
            data_weight = 0.9
        
        baseline_weight = 1 - data_weight
        
        # Weighted average
        baseline_steps = baseline.baseline_avg_daily_steps if baseline else 5000
        weighted_avg_steps = (avg_steps * data_weight) + (baseline_steps * baseline_weight)
        
        # Risk assessment based on weighted average
        if weighted_avg_steps < 3000:
            penalty = 40
            risk_factors.append('very_low_activity')
            recommendations.append('⚠️ Very low activity increases diabetes risk significantly. Try to increase daily movement.')
        elif weighted_avg_steps < 5000:
            penalty = 25
            risk_factors.append('low_activity')
            recommendations.append('⚠️ Low activity levels detected. Aim for at least 7,000 steps daily.')
        elif weighted_avg_steps < 7000:
            penalty = 10
            risk_factors.append('below_recommended_activity')
            recommendations.append('💪 Good start! Try to reach 7,000+ steps for better health.')
        elif weighted_avg_steps >= 10000:
            penalty = -5
            recommendations.append('🎉 Excellent! You\'re meeting daily step recommendations!')
        else:
            penalty = 0
            recommendations.append('✅ Good activity level. Keep it up!')
        
        risk_score += penalty * data_weight
        
        # Activity consistency
        if days_tracked >= 7:
            active_days = metrics.get('days_met_goal_7d', 0)
            if active_days < 3:
                risk_score += 10
                risk_factors.append('inconsistent_activity')
                recommendations.append('📅 Try to be active at least 5 days per week.')
        
        # Ensure risk_score is not negative
        risk_score = max(0, risk_score)
        
        # Determine risk category
        if risk_score >= 76:
            risk_category = 'very_high'
        elif risk_score >= 51:
            risk_category = 'high'
        elif risk_score >= 26:
            risk_category = 'moderate'
        else:
            risk_category = 'low'
        
        # Data quality warning
        if days_tracked < 7:
            recommendations.insert(0, f'⚠️ Assessment based on only {days_tracked} day(s). Track for at least 7 days for reliable assessment.')
        
        return {
            'risk_score': round(risk_score, 1),
            'risk_category': risk_category,
            'risk_factors': risk_factors,
            'data_quality': confidence
        }
    
    @staticmethod
    def save_risk_assessment(user_id):
        """Save current risk assessment to history"""
        try:
            metrics = StepMetrics.find_by_user_id(user_id)
            if not metrics:
                return None
            
            today = datetime.utcnow().date().strftime('%Y-%m-%d')
            
            # Create assessment
            assessment = StepRiskAssessment(
                user_id=user_id,
                assessment_date=today,
                risk_category=metrics.risk_category,
                risk_score=metrics.risk_score,
                risk_factors=metrics.risk_factors,
                data_quality=getattr(metrics, 'data_quality', 'unknown'),
                metrics_snapshot=metrics.to_dict()
            )
            assessment.save()
            
            return assessment
            
        except Exception as e:
            logging.error(f"Error saving risk assessment: {str(e)}")
            raise