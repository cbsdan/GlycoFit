"""
Sleep Tracking Controller

API endpoints for sleep tracking and diabetes risk assessment:
- POST /baseline - Create manual baseline (required at onboarding)
- GET /baseline - Get user's sleep baseline
- POST /daily - Log manual daily sleep record
- GET /daily - Get daily sleep records
- DELETE /daily/:date - Delete daily record
- POST /health-connect/sync - Sync Health Connect data
- GET /metrics - Get computed sleep metrics
- GET /risk - Get risk assessment
- GET /risk/history - Get risk assessment history
- GET /summary - Get comprehensive sleep summary
"""

from flask import request, jsonify
from services.sleep_tracking_service import get_sleep_tracking_service
from models.sleep_tracking import ensure_all_sleep_indexes
import logging


def get_current_user_id():
    """Get the current authenticated user's ID from Firebase auth middleware"""
    return getattr(request, 'current_user_id', None)


# ==================== BASELINE ENDPOINTS ====================

def create_baseline():
    """
    Create manual baseline sleep input (required at onboarding).
    This can only be done once per user and cannot be modified.
    
    Request Body:
    {
        "baseline_avg_sleep_hours": 7.5,
        "baseline_nights_6h_plus_per_week": 5,
        "baseline_bedtime_consistency": 4,
        "usual_bedtime": "22:30",
        "usual_wake_time": "06:30"
    }
    
    Response:
    {
        "success": true,
        "message": "Sleep baseline created successfully",
        "data": { ... baseline data ... }
    }
    """
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "Request body is required"
            }), 400
        
        # Validate required fields
        required_fields = [
            "baseline_avg_sleep_hours",
            "baseline_nights_6h_plus_per_week",
            "baseline_bedtime_consistency"
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        service = get_sleep_tracking_service()
        baseline = service.create_baseline(
            user_id=user_id,
            baseline_avg_sleep_hours=float(data["baseline_avg_sleep_hours"]),
            baseline_nights_6h_plus_per_week=int(data["baseline_nights_6h_plus_per_week"]),
            baseline_bedtime_consistency=int(data["baseline_bedtime_consistency"]),
            usual_bedtime=data.get("usual_bedtime"),
            usual_wake_time=data.get("usual_wake_time")
        )
        
        return jsonify({
            "success": True,
            "message": "Sleep baseline created successfully",
            "data": baseline
        }), 201
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logging.error(f"Error creating baseline: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to create sleep baseline"
        }), 500


def get_baseline():
    """
    Get user's sleep baseline.
    
    Response:
    {
        "success": true,
        "data": { ... baseline data ... },
        "has_baseline": true
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_sleep_tracking_service()
        baseline = service.get_baseline(user_id)
        
        return jsonify({
            "success": True,
            "data": baseline,
            "has_baseline": baseline is not None
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting baseline: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get sleep baseline"
        }), 500


def update_baseline():
    """
    Update existing sleep baseline (retake questionnaire).
    
    Request Body:
    {
        "baseline_avg_sleep_hours": 7.5,
        "baseline_nights_6h_plus_per_week": 5,
        "baseline_bedtime_consistency": 4,
        "usual_bedtime": "22:30",
        "usual_wake_time": "06:30"
    }
    
    Response:
    {
        "success": true,
        "message": "Sleep baseline updated successfully",
        "data": { ... baseline data ... }
    }
    """
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "Request body is required"
            }), 400
        
        # Validate required fields
        required_fields = [
            "baseline_avg_sleep_hours",
            "baseline_nights_6h_plus_per_week",
            "baseline_bedtime_consistency"
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        service = get_sleep_tracking_service()
        baseline = service.update_baseline(
            user_id=user_id,
            baseline_avg_sleep_hours=float(data["baseline_avg_sleep_hours"]),
            baseline_nights_6h_plus_per_week=int(data["baseline_nights_6h_plus_per_week"]),
            baseline_bedtime_consistency=int(data["baseline_bedtime_consistency"]),
            usual_bedtime=data.get("usual_bedtime"),
            usual_wake_time=data.get("usual_wake_time")
        )
        
        return jsonify({
            "success": True,
            "message": "Sleep baseline updated successfully",
            "data": baseline
        }), 200
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logging.error(f"Error updating baseline: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to update sleep baseline"
        }), 500


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
        service = get_sleep_tracking_service()
        has_baseline = service.has_baseline(user_id)
        
        return jsonify({
            "success": True,
            "has_baseline": has_baseline
        }), 200
        
    except Exception as e:
        logging.error(f"Error checking baseline: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to check baseline status"
        }), 500


# ==================== DAILY RECORD ENDPOINTS ====================

def log_daily_sleep():
    """
    Log manual daily sleep record.
    
    Request Body:
    {
        "date": "2024-01-15",
        "bedtime": "22:30",
        "sleep_duration_hours": 7.5,
        "wake_time": "06:00",  // optional
        "sleep_quality": 4,     // optional (1-5)
        "notes": "Felt rested"  // optional
    }
    
    Response:
    {
        "success": true,
        "message": "Sleep record logged successfully",
        "data": { ... record data ... }
    }
    """
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "Request body is required"
            }), 400
        
        # Validate required fields
        required_fields = ["date", "bedtime", "sleep_duration_hours"]
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        service = get_sleep_tracking_service()
        record = service.log_manual_sleep(
            user_id=user_id,
            date=data["date"],
            bedtime=data["bedtime"],
            sleep_duration_hours=float(data["sleep_duration_hours"]),
            wake_time=data.get("wake_time"),
            sleep_quality=int(data["sleep_quality"]) if data.get("sleep_quality") else None,
            notes=data.get("notes")
        )
        
        return jsonify({
            "success": True,
            "message": "Sleep record logged successfully",
            "data": record
        }), 201
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logging.error(f"Error logging daily sleep: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to log sleep record"
        }), 500


def get_daily_records():
    """
    Get daily sleep records.
    
    Query Parameters:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - days: Number of days to fetch (default: 30)
    - source: Filter by source (manual, health_connect)
    
    Response:
    {
        "success": true,
        "data": [ ... records ... ],
        "count": 15
    }
    """
    try:
        user_id = get_current_user_id()
        
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        days = int(request.args.get("days", 30))
        source = request.args.get("source")
        
        service = get_sleep_tracking_service()
        records = service.get_daily_records(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            days=days,
            source=source
        )
        
        return jsonify({
            "success": True,
            "data": records,
            "count": len(records)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting daily records: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get sleep records"
        }), 500


def delete_daily_record(date):
    """
    Delete daily sleep record(s) for a specific date.
    
    Path Parameters:
    - date: Date to delete (YYYY-MM-DD)
    
    Query Parameters:
    - source: Optional filter by source (manual, health_connect)
    
    Response:
    {
        "success": true,
        "message": "Deleted 1 record(s)",
        "deleted": 1
    }
    """
    try:
        user_id = get_current_user_id()
        source = request.args.get("source")
        
        service = get_sleep_tracking_service()
        result = service.delete_daily_record(user_id, date, source)
        
        return jsonify({
            "success": True,
            "message": result["message"],
            "deleted": result["deleted"]
        }), 200
        
    except Exception as e:
        logging.error(f"Error deleting daily record: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to delete sleep record"
        }), 500


# ==================== HEALTH CONNECT ENDPOINTS ====================

def sync_health_connect():
    """
    Sync sleep data from Health Connect.
    
    Request Body:
    {
        "records": [
            {
                "date": "2024-01-15",
                "bedtime": "22:30",
                "wake_time": "06:00",
                "sleep_duration_hours": 7.5
            },
            ...
        ]
    }
    
    Response:
    {
        "success": true,
        "message": "Successfully synced 10 sleep records",
        "synced": 10,
        "skipped": 0,
        "errors": null
    }
    """
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data or "records" not in data:
            return jsonify({
                "success": False,
                "error": "Request body must contain 'records' array"
            }), 400
        
        records = data["records"]
        if not isinstance(records, list):
            return jsonify({
                "success": False,
                "error": "'records' must be an array"
            }), 400
        
        service = get_sleep_tracking_service()
        result = service.sync_health_connect_sleep(user_id, records)
        
        return jsonify({
            "success": True,
            "message": result["message"],
            "synced": result["synced"],
            "skipped": result["skipped"],
            "errors": result["errors"]
        }), 200
        
    except Exception as e:
        logging.error(f"Error syncing Health Connect: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to sync Health Connect data"
        }), 500


# ==================== METRICS ENDPOINTS ====================

def get_metrics():
    """
    Get computed sleep metrics.
    
    Response:
    {
        "success": true,
        "data": {
            "avg_sleep_7d": 7.2,
            "avg_sleep_30d": 7.0,
            "bedtime_mean_30d": "22:45",
            "bedtime_variability_30d": 35.5,
            "sleep_variability_30d": 0.8,
            "dominant_sleep_source": "mixed",
            "days_with_data_7d": 5,
            "days_with_data_30d": 18,
            "risk_category": "low",
            "risk_factors": [],
            "risk_score": 15.0,
            "computed_at": "2024-01-15T10:30:00Z"
        }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_sleep_tracking_service()
        metrics = service.get_metrics(user_id)
        
        if not metrics:
            return jsonify({
                "success": True,
                "data": None,
                "message": "No metrics available. Please complete baseline first."
            }), 200
        
        return jsonify({
            "success": True,
            "data": metrics
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting metrics: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get sleep metrics"
        }), 500



def refresh_metrics():
    """
    Force refresh of sleep metrics.
    
    Response:
    {
        "success": true,
        "message": "Metrics refreshed successfully",
        "data": { ... metrics ... }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_sleep_tracking_service()
        metrics = service.compute_metrics(user_id)
        
        return jsonify({
            "success": True,
            "message": "Metrics refreshed successfully",
            "data": metrics
        }), 200
        
    except Exception as e:
        logging.error(f"Error refreshing metrics: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to refresh metrics"
        }), 500


# ==================== RISK ASSESSMENT ENDPOINTS ====================

def get_risk_assessment():
    """
    Get latest risk assessment.
    
    Response:
    {
        "success": true,
        "data": {
            "assessment_date": "2024-01-15",
            "risk_category": "moderate",
            "risk_score": 35.0,
            "risk_factors": ["short_sleep", "moderate_bedtime_variability"],
            "recommendations": [...],
            "data_quality": "good"
        }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_sleep_tracking_service()
        assessment = service.get_risk_assessment(user_id)
        
        if not assessment:
            return jsonify({
                "success": True,
                "data": None,
                "message": "No risk assessment available. Please complete baseline first."
            }), 200
        
        return jsonify({
            "success": True,
            "data": assessment
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting risk assessment: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get risk assessment"
        }), 500


def get_risk_history():
    """
    Get risk assessment history.
    
    Query Parameters:
    - limit: Maximum number of assessments (default: 30)
    
    Response:
    {
        "success": true,
        "data": [ ... assessments ... ],
        "count": 15
    }
    """
    try:
        user_id = get_current_user_id()
        limit = int(request.args.get("limit", 30))
        
        service = get_sleep_tracking_service()
        history = service.get_risk_history(user_id, limit)
        
        return jsonify({
            "success": True,
            "data": history,
            "count": len(history)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting risk history: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get risk history"
        }), 500


# ==================== SUMMARY ENDPOINT ====================

def get_sleep_summary():
    """
    Get comprehensive sleep summary for dashboard.
    
    Response:
    {
        "success": true,
        "data": {
            "status": {
                "has_baseline": true,
                "has_daily_data": true,
                "days_tracked_last_week": 5,
                "onboarding_complete": true
            },
            "baseline": { ... },
            "metrics": { ... },
            "risk_assessment": { ... },
            "recent_records": [ ... ],
            "recommendations": [ ... ]
        }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_sleep_tracking_service()
        summary = service.get_sleep_summary(user_id)
        
        return jsonify({
            "success": True,
            "data": summary
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting sleep summary: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get sleep summary"
        }), 500


def cleanup_duplicate_records():
    """
    Remove duplicate sleep records for the current user.
    Keeps the most recent record for each (user_id, date, source) combination.
    
    Response:
    {
        "success": true,
        "message": "Removed X duplicate records",
        "deleted_count": X
    }
    """
    try:
        user_id = get_current_user_id()
        from models.sleep_tracking import SleepDailyRecord
        
        deleted_count = SleepDailyRecord.remove_duplicates(user_id)
        
        # Recompute metrics after cleanup
        if deleted_count > 0:
            service = get_sleep_tracking_service()
            service.compute_metrics(user_id)
        
        return jsonify({
            "success": True,
            "message": f"Removed {deleted_count} duplicate record(s)",
            "deleted_count": deleted_count
        }), 200
        
    except Exception as e:
        logging.error(f"Error cleaning up duplicates: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to clean up duplicates"
        }), 500


# ==================== INITIALIZATION ====================

def init_sleep_tracking_indexes():
    """Initialize database indexes for sleep tracking collections"""
    try:
        ensure_all_sleep_indexes()
        logging.info("Sleep tracking indexes initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize sleep tracking indexes: {e}")
