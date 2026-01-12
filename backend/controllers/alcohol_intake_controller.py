"""
Alcohol Intake Controller

Handles HTTP requests for alcohol intake tracking and risk assessment.
Follows the same pattern as sleep tracking with baseline + daily logs.
"""

from flask import jsonify, request
import logging
from models.alcohol_intake import (
    AlcoholBaseline,
    AlcoholDailyRecord,
    AlcoholMetrics,
    AlcoholRiskAssessment,
    AlcoholRiskCategory,
    DrinkingPattern
)
from models.user import User

logger = logging.getLogger(__name__)


def get_current_user_id():
    """Get the current authenticated user's ID from Firebase auth middleware"""
    return getattr(request, 'current_user_id', None)


# ==================== BASELINE ENDPOINTS ====================

def create_baseline():
    """
    Create alcohol baseline (onboarding questionnaire).
    This represents typical drinking pattern over past 3 months.
    
    Request Body:
    {
        "baseline_drinking_days_per_week": 2.0,
        "baseline_drinks_per_occasion": 3.0,
        "baseline_binge_frequency_per_month": 1,
        "drinking_pattern": "weekends",
        "years_at_current_pattern": 2,
        "drinks_with_meals": true
    }
    
    Response:
    {
        "success": true,
        "message": "Alcohol baseline created successfully",
        "data": { ... baseline data ... }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Check if baseline already exists
        if AlcoholBaseline.exists_for_user(user_id):
            return jsonify({
                'success': False,
                'message': 'Baseline already exists. Use PUT /baseline to update.'
            }), 409
        
        # Validate required fields
        required_fields = ['baseline_drinking_days_per_week', 'baseline_drinks_per_occasion', 'baseline_binge_frequency_per_month']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Create baseline
        baseline = AlcoholBaseline(
            user_id=user_id,
            baseline_drinking_days_per_week=data['baseline_drinking_days_per_week'],
            baseline_drinks_per_occasion=data['baseline_drinks_per_occasion'],
            baseline_binge_frequency_per_month=data['baseline_binge_frequency_per_month'],
            drinking_pattern=data.get('drinking_pattern', DrinkingPattern.NONE),
            years_at_current_pattern=data.get('years_at_current_pattern', 0),
            drinks_with_meals=data.get('drinks_with_meals', False)
        )
        baseline.save()
        
        logger.info(f"Alcohol baseline created for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Alcohol baseline created successfully',
            'data': baseline.to_dict()
        }), 201
        
    except ValueError as e:
        logger.warning(f"Validation error in alcohol baseline creation: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 400
        
    except Exception as e:
        logger.error(f"Error creating alcohol baseline: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_baseline():
    """
    Get user's alcohol baseline.
    
    Response:
    {
        "success": true,
        "data": { ... baseline data ... },
        "has_baseline": true
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        baseline = AlcoholBaseline.find_by_user_id(user_id)
        
        if not baseline:
            return jsonify({
                'success': True,
                'data': None,
                'has_baseline': False
            }), 200
        
        return jsonify({
            'success': True,
            'data': baseline.to_dict(),
            'has_baseline': True
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving alcohol baseline: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def update_baseline():
    """
    Update existing alcohol baseline (retake questionnaire).
    
    Request Body: Same as create_baseline
    
    Response:
    {
        "success": true,
        "message": "Alcohol baseline updated successfully",
        "data": { ... baseline data ... }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        baseline = AlcoholBaseline.find_by_user_id(user_id)
        if not baseline:
            return jsonify({
                'success': False,
                'message': 'No baseline found. Use POST /baseline to create one.'
            }), 404
        
        # Update fields if provided
        if 'baseline_drinking_days_per_week' in data:
            baseline.baseline_drinking_days_per_week = float(data['baseline_drinking_days_per_week'])
        if 'baseline_drinks_per_occasion' in data:
            baseline.baseline_drinks_per_occasion = float(data['baseline_drinks_per_occasion'])
        if 'baseline_binge_frequency_per_month' in data:
            baseline.baseline_binge_frequency_per_month = int(data['baseline_binge_frequency_per_month'])
        if 'drinking_pattern' in data:
            baseline.drinking_pattern = data['drinking_pattern']
        if 'years_at_current_pattern' in data:
            baseline.years_at_current_pattern = int(data['years_at_current_pattern'])
        if 'drinks_with_meals' in data:
            baseline.drinks_with_meals = bool(data['drinks_with_meals'])
        
        baseline.save()
        
        logger.info(f"Alcohol baseline updated for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Alcohol baseline updated successfully',
            'data': baseline.to_dict()
        }), 200
        
    except ValueError as e:
        logger.warning(f"Validation error in alcohol baseline update: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 400
        
    except Exception as e:
        logger.error(f"Error updating alcohol baseline: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def check_baseline():
    """
    Check if user has completed baseline.
    
    Response:
    {
        "success": true,
        "has_baseline": true/false
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        has_baseline = AlcoholBaseline.exists_for_user(user_id)
        
        return jsonify({
            'success': True,
            'has_baseline': has_baseline
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking alcohol baseline: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== DAILY RECORD ENDPOINTS ====================

def log_daily_alcohol():
    """
    Log daily alcohol consumption.
    
    Request Body:
    {
        "date": "2024-01-15",
        "drinks_consumed": 2.0,
        "was_binge_episode": false,
        "drinking_context": "social",
        "time_of_day": "evening",
        "notes": "Dinner with friends"
    }
    
    Response:
    {
        "success": true,
        "message": "Alcohol consumption logged successfully",
        "data": { ... record data ... }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        if 'date' not in data or 'drinks_consumed' not in data:
            return jsonify({'success': False, 'message': 'Missing required fields: date, drinks_consumed'}), 400
        
        # Validate drinks_consumed
        drinks = float(data['drinks_consumed'])
        if drinks < 0 or drinks > 20:
            return jsonify({'success': False, 'message': 'drinks_consumed must be between 0 and 20'}), 400
        
        # Get user gender for binge determination
        user_gender = None
        try:
            user = User.get_by_id(user_id)
            user_gender = user.get('gender', '').lower() if user else None
        except Exception as e:
            logger.warning(f"Could not get user gender: {str(e)}")
        
        # Auto-determine binge episode if not specified
        was_binge = data.get('was_binge_episode')
        if was_binge is None:
            binge_threshold = 4 if user_gender == 'female' else 5
            was_binge = drinks >= binge_threshold
        
        # Create or update daily record
        record = AlcoholDailyRecord(
            user_id=user_id,
            date=data['date'],
            drinks_consumed=drinks,
            was_binge_episode=bool(was_binge),
            drinking_context=data.get('drinking_context', 'other'),
            time_of_day=data.get('time_of_day', 'evening'),
            notes=data.get('notes')
        )
        record.save()
        
        # Recompute metrics
        metrics = AlcoholMetrics.compute_for_user(user_id, user_gender)
        metrics.save()
        
        logger.info(f"Alcohol consumption logged for user {user_id} on {data['date']}")
        
        return jsonify({
            'success': True,
            'message': 'Alcohol consumption logged successfully',
            'data': record.to_dict()
        }), 201
        
    except ValueError as e:
        logger.warning(f"Validation error in alcohol log: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 400
        
    except Exception as e:
        logger.error(f"Error logging alcohol consumption: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def get_daily_records():
    """
    Get daily alcohol records.
    
    Query Parameters:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - days: Number of days to fetch (default: 30)
    
    Response:
    {
        "success": true,
        "data": [ ... records ... ],
        "count": 15
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        days = int(request.args.get('days', 30))
        
        records = AlcoholDailyRecord.find_by_user_date_range(
            user_id,
            start_date=start_date,
            end_date=end_date,
            days=days
        )
        
        return jsonify({
            'success': True,
            'data': [r.to_dict() for r in records],
            'count': len(records)
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving daily alcohol records: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def delete_daily_record(date):
    """
    Delete daily alcohol record for a specific date.
    
    Path Parameters:
    - date: Date to delete (YYYY-MM-DD)
    
    Response:
    {
        "success": true,
        "message": "Record deleted successfully"
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        deleted = AlcoholDailyRecord.delete_by_user_and_date(user_id, date)
        
        if not deleted:
            return jsonify({
                'success': False,
                'message': f'No record found for date {date}'
            }), 404
        
        # Recompute metrics
        user_gender = None
        try:
            user = User.get_by_id(user_id)
            user_gender = user.get('gender', '').lower() if user else None
        except:
            pass
        
        metrics = AlcoholMetrics.compute_for_user(user_id, user_gender)
        metrics.save()
        
        logger.info(f"Alcohol record deleted for user {user_id} on {date}")
        
        return jsonify({
            'success': True,
            'message': 'Record deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting alcohol record: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== METRICS ENDPOINTS ====================

def get_metrics():
    """
    Get computed alcohol metrics.
    
    Query Parameters:
    - refresh: Force refresh metrics (true/false)
    
    Response:
    {
        "success": true,
        "data": { ... metrics ... }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        refresh = request.args.get('refresh', 'false').lower() == 'true'
        
        # Get user gender
        user_gender = None
        try:
            user = User.get_by_id(user_id)
            user_gender = user.get('gender', '').lower() if user else None
        except:
            pass
        
        if refresh:
            metrics = AlcoholMetrics.compute_for_user(user_id, user_gender)
            metrics.save()
        else:
            metrics = AlcoholMetrics.find_by_user_id(user_id)
            if not metrics:
                metrics = AlcoholMetrics.compute_for_user(user_id, user_gender)
                metrics.save()
        
        return jsonify({
            'success': True,
            'data': metrics.to_dict() if metrics else None
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving alcohol metrics: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


def refresh_metrics():
    """
    Force refresh alcohol metrics.
    
    Response:
    {
        "success": true,
        "message": "Metrics refreshed successfully",
        "data": { ... metrics ... }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        # Get user gender
        user_gender = None
        try:
            user = User.get_by_id(user_id)
            user_gender = user.get('gender', '').lower() if user else None
        except:
            pass
        
        metrics = AlcoholMetrics.compute_for_user(user_id, user_gender)
        metrics.save()
        
        return jsonify({
            'success': True,
            'message': 'Metrics refreshed successfully',
            'data': metrics.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error refreshing alcohol metrics: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== RISK ASSESSMENT ENDPOINTS ====================

def get_risk_assessment():
    """
    Get comprehensive risk assessment based on baseline and daily data.
    
    Response:
    {
        "success": true,
        "data": { ... risk assessment ... }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        # Get user gender
        user_gender = None
        try:
            user = User.get_by_id(user_id)
            user_gender = user.get('gender', '').lower() if user else None
        except:
            pass
        
        assessment = AlcoholRiskAssessment.generate_assessment(user_id, user_gender)
        
        return jsonify({
            'success': True,
            'message': 'Risk assessment generated successfully',
            'data': assessment
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating risk assessment: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== SUMMARY ENDPOINT ====================

def get_alcohol_summary():
    """
    Get comprehensive dashboard summary (baseline + metrics + risk).
    
    Response:
    {
        "success": true,
        "data": {
            "has_baseline": true,
            "baseline": { ... },
            "metrics": { ... },
            "risk_assessment": { ... },
            "recent_records": [ ... ]
        }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        # Get user gender
        user_gender = None
        try:
            user = User.get_by_id(user_id)
            user_gender = user.get('gender', '').lower() if user else None
        except:
            pass
        
        # Get baseline
        baseline = AlcoholBaseline.find_by_user_id(user_id)
        
        # Get or compute metrics
        metrics = AlcoholMetrics.find_by_user_id(user_id)
        if not metrics:
            metrics = AlcoholMetrics.compute_for_user(user_id, user_gender)
            metrics.save()
        
        # Get risk assessment
        risk_assessment = AlcoholRiskAssessment.generate_assessment(user_id, user_gender)
        
        # Get recent records
        recent_records = AlcoholDailyRecord.find_by_user_date_range(user_id, days=30)
        
        return jsonify({
            'success': True,
            'data': {
                'has_baseline': baseline is not None,
                'baseline': baseline.to_dict() if baseline else None,
                'metrics': metrics.to_dict() if metrics else None,
                'risk_assessment': risk_assessment,
                'recent_records': [r.to_dict() for r in recent_records],
                'record_count': len(recent_records)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating alcohol summary: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== INITIALIZATION ====================

def init_alcohol_tracking_indexes():
    """Initialize database indexes for alcohol tracking"""
    from models.alcohol_intake import ensure_all_alcohol_indexes
    ensure_all_alcohol_indexes()
