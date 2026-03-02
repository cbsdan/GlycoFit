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
from services.food_tracking_service import FoodTrackingService
from services.sleep_tracking_service import get_sleep_tracking_service
from services.step_tracking_service import StepTrackingService
from services.smoking_tracking_service import get_smoking_tracking_service
from models.alcohol_intake import AlcoholBaseline, AlcoholMetrics
from models.smoking_tracking import SmokingBaseline, SmokingMetrics
from models.step_tracking import StepBaseline
from models.user import User

logger = logging.getLogger(__name__)


def get_current_user_id():
    """Get the current authenticated user's ID from Firebase auth middleware"""
    return getattr(request, 'current_user_id', None)


def get_unified_recommendations():
    """
    Get unified recommendations for all lifestyle trackers.
    
    Consolidates data from all trackers and provides:
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
        
        service = get_lifestyle_recommendation_service()
        
        # Gather data from each tracker
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
        
        # 2. Sleep Tracker
        try:
            sleep_service = get_sleep_tracking_service()
            sleep_summary = sleep_service.get_sleep_summary(user_id)
            
            if sleep_summary and sleep_summary.get('metrics'):
                metrics = sleep_summary['metrics']
                risk = sleep_summary.get('risk_assessment', {})
                
                sleep_predictions = service.predict_sleep_impact(
                    avg_sleep_hours=metrics.get('avg_sleep_7d') or metrics.get('avg_sleep_30d', 7),
                    sleep_variability_hours=metrics.get('sleep_variability_30d'),
                    bedtime_variability_minutes=metrics.get('bedtime_variability_30d'),
                    duration_days=metrics.get('days_with_data_30d', 0)
                )
                trackers_data['sleep'] = {
                    'has_data': True,
                    'risk_score': risk.get('score', 0),
                    'risk_category': risk.get('category', 'unknown'),
                    'predictions': sleep_predictions
                }
            else:
                trackers_data['sleep'] = {
                    'has_data': False,
                    'healthy_defaults': service.get_healthy_defaults()['guidelines']['sleep']
                }
        except Exception as e:
            logger.error(f"Error getting sleep data: {e}")
            trackers_data['sleep'] = {'has_data': False, 'error': str(e)}
        
        # 3. Activity Tracker (Steps)
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
        
        # 4. Alcohol Tracker
        try:
            alcohol_metrics = AlcoholMetrics.find_by_user_id(user_id)
            alcohol_baseline = AlcoholBaseline.find_by_user_id(user_id)
            
            # Get user gender for proper thresholds
            user_gender = 'male'
            try:
                user = User.get_by_id(user_id)
                user_gender = user.get('gender', 'male').lower() if user else 'male'
            except:
                pass
            
            if alcohol_metrics or alcohol_baseline:
                if alcohol_metrics:
                    drinks_per_week = alcohol_metrics.avg_drinks_per_week_30d or 0
                    binge_episodes = alcohol_metrics.binge_episodes_30d or 0
                    data_days = alcohol_metrics.days_with_data_30d or 0
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
        
        # 5. Smoking Tracker
        try:
            smoking_service = get_smoking_tracking_service()
            baseline = smoking_service.get_baseline(user_id)
            
            if baseline:
                # Get metrics to calculate pack-years
                metrics = smoking_service.get_metrics(user_id)
                
                # If no metrics yet, compute them
                if not metrics:
                    logger.info(f"Computing initial metrics for unified recommendations for user {user_id}")
                    metrics = smoking_service.compute_metrics(user_id)
                
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
                
                smoking_predictions = service.predict_smoking_impact(
                    smoking_status=smoking_status,
                    pack_years=pack_years,
                    years_since_quit=years_since_quit
                )
                trackers_data['smoking'] = {
                    'has_data': True,
                    'status': smoking_status,
                    'risk_multiplier': smoking_predictions.get('risk_multiplier', 1.0),
                    'risk_category': smoking_predictions.get('risk_category'),
                    'predictions': smoking_predictions
                }
            else:
                trackers_data['smoking'] = {
                    'has_data': False,
                    'healthy_defaults': service.get_healthy_defaults()['guidelines']['smoking']
                }
        except Exception as e:
            logger.error(f"Error getting smoking data: {e}")
            trackers_data['smoking'] = {'has_data': False, 'error': str(e)}
        
        # Calculate overall risk
        food_risk_data = trackers_data.get('food', {}).get('predictions') if trackers_data.get('food', {}).get('has_data') else None
        sleep_risk_data = trackers_data.get('sleep', {}).get('predictions') if trackers_data.get('sleep', {}).get('has_data') else None
        activity_risk_data = trackers_data.get('activity', {}).get('predictions') if trackers_data.get('activity', {}).get('has_data') else None
        alcohol_risk_data = trackers_data.get('alcohol', {}).get('predictions') if trackers_data.get('alcohol', {}).get('has_data') else None
        smoking_risk_data = trackers_data.get('smoking', {}).get('predictions') if trackers_data.get('smoking', {}).get('has_data') else None
        
        overall_assessment = service.calculate_overall_lifestyle_risk(
            food_risk=food_risk_data,
            sleep_risk=sleep_risk_data,
            activity_risk=activity_risk_data,
            alcohol_risk=alcohol_risk_data,
            smoking_risk=smoking_risk_data
        )
        
        return jsonify({
            'success': True,
            'data': {
                'overall_risk_score': overall_assessment['overall_risk_score'],
                'overall_risk_category': overall_assessment['overall_risk_category'],
                'trackers': trackers_data,
                'trackers_analyzed': overall_assessment['trackers_analyzed'],
                'trackers_missing': overall_assessment['trackers_missing'],
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
            user = User.get_by_id(user_id)
            user_gender = user.get('gender', 'male').lower() if user else 'male'
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
