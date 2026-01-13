from flask import request, jsonify
from datetime import datetime, timedelta
from bson import ObjectId
from models.step_tracking import StepBaseline, StepMetrics, StepRiskAssessment
from services.step_tracking_service import StepTrackingService

class StepTrackingController:
    """Controller for step tracking endpoints - follows sleep_tracking_controller.py pattern"""
    
    @staticmethod
    def create_baseline(user_id):
        """Create step baseline (onboarding)"""
        try:
            # Convert ObjectId to string if needed
            if isinstance(user_id, ObjectId):
                user_id = str(user_id)
            
            # Check if baseline exists
            if StepBaseline.exists_for_user(user_id):
                return jsonify({
                    'success': False,
                    'error': 'Step baseline already exists. Use PUT to update.'
                }), 400
            
            data = request.get_json()
            
            # Validate required fields
            required = [
                'baseline_avg_daily_steps',
                'baseline_activity_level',
                'baseline_days_active_per_week',
                'baseline_exercise_minutes_per_week',
                'baseline_work_type'
            ]
            
            missing = [f for f in required if f not in data]
            if missing:
                return jsonify({
                    'success': False,
                    'error': f'Missing required fields: {", ".join(missing)}'
                }), 400
            
            # Create baseline
            baseline = StepBaseline(
                user_id=user_id,
                baseline_avg_daily_steps=data['baseline_avg_daily_steps'],
                baseline_activity_level=data['baseline_activity_level'],
                baseline_days_active_per_week=data['baseline_days_active_per_week'],
                baseline_exercise_minutes_per_week=data['baseline_exercise_minutes_per_week'],
                baseline_work_type=data['baseline_work_type']
            )
            baseline.save()
            
            # Initialize metrics
            StepTrackingService.compute_metrics(user_id)
            
            return jsonify({
                'success': True,
                'message': 'Step baseline created successfully',
                'data': baseline.to_dict()
            }), 201
            
        except Exception as e:
            import traceback
            print(f"Error in create_baseline: {str(e)}")
            print(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    def get_baseline(user_id):
        """Get user's step baseline"""
        try:
            # Convert ObjectId to string if needed
            if isinstance(user_id, ObjectId):
                user_id = str(user_id)
                
            baseline = StepBaseline.find_by_user_id(user_id)
            
            if not baseline:
                return jsonify({
                    'success': False,
                    'error': 'Step baseline not found'
                }), 404
            
            return jsonify({
                'success': True,
                'data': baseline.to_dict(),
                'has_baseline': True
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    def check_baseline(user_id):
        """Quick check if baseline exists"""
        try:
            # Convert ObjectId to string if needed
            if isinstance(user_id, ObjectId):
                user_id = str(user_id)
                
            has_baseline = StepBaseline.exists_for_user(user_id)
            
            return jsonify({
                'success': True,
                'has_baseline': has_baseline
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    def update_baseline(user_id):
        """Update step baseline"""
        try:
            # Convert ObjectId to string if needed
            if isinstance(user_id, ObjectId):
                user_id = str(user_id)
                
            baseline = StepBaseline.find_by_user_id(user_id)
            
            if not baseline:
                return jsonify({
                    'success': False,
                    'error': 'Step baseline not found'
                }), 404
            
            data = request.get_json()
            
            # Update fields
            if 'baseline_avg_daily_steps' in data:
                baseline.baseline_avg_daily_steps = data['baseline_avg_daily_steps']
            if 'baseline_activity_level' in data:
                baseline.baseline_activity_level = data['baseline_activity_level']
            if 'baseline_days_active_per_week' in data:
                baseline.baseline_days_active_per_week = data['baseline_days_active_per_week']
            if 'baseline_exercise_minutes_per_week' in data:
                baseline.baseline_exercise_minutes_per_week = data['baseline_exercise_minutes_per_week']
            if 'baseline_work_type' in data:
                baseline.baseline_work_type = data['baseline_work_type']
            
            baseline.save()
            
            # Recompute metrics
            StepTrackingService.compute_metrics(user_id)
            
            return jsonify({
                'success': True,
                'message': 'Step baseline updated successfully',
                'data': baseline.to_dict()
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    def get_metrics(user_id):
        """Get computed metrics"""
        try:
            # Convert ObjectId to string if needed
            if isinstance(user_id, ObjectId):
                user_id = str(user_id)
                
            # Refresh metrics
            metrics_data = StepTrackingService.compute_metrics(user_id)
            
            return jsonify({
                'success': True,
                'data': metrics_data
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    def get_summary(user_id, days=7):
        """Get comprehensive summary"""
        try:
            # Convert ObjectId to string if needed
            if isinstance(user_id, ObjectId):
                user_id = str(user_id)
                
            from models.user_activity import UserActivity
            from config.database import get_db
            
            baseline = StepBaseline.find_by_user_id(user_id)
            metrics = StepMetrics.find_by_user_id(user_id)
            
            # Get recent activity records from user_activity collection
            db = get_db()
            user_activity = UserActivity(db)
            
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=days)
            
            recent_records = user_activity.get_activity_by_date_range(
                user_id,
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )
            
            return jsonify({
                'success': True,
                'data': {
                    'status': {
                        'has_baseline': baseline is not None,
                        'has_daily_data': len(recent_records) > 0,
                        'days_tracked_last_week': len(recent_records),
                        'onboarding_complete': baseline is not None
                    },
                    'baseline': baseline.to_dict() if baseline else None,
                    'metrics': metrics.to_dict() if metrics else None,
                    'recent_records': recent_records
                }
            }), 200
            
        except Exception as e:
            import traceback
            print(f"Error in get_summary: {str(e)}")
            print(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500