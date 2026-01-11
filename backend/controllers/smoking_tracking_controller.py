"""
Smoking Tracking Controller

API endpoints for smoking tracking and diabetes risk assessment:
- POST /baseline - Create manual baseline (required at onboarding)
- GET /baseline - Get user's smoking baseline
- PUT /baseline - Update baseline (retake questionnaire)
- GET /baseline/check - Check if baseline exists
- POST /daily - Log manual daily smoking record
- GET /daily - Get daily smoking records
- DELETE /daily/:date - Delete daily record
- GET /metrics - Get computed smoking metrics
- POST /metrics/refresh - Force refresh metrics
- GET /risk - Get risk assessment
- GET /risk/history - Get risk assessment history
- GET /summary - Get comprehensive smoking summary
"""

from flask import request, jsonify
from services.smoking_tracking_service import get_smoking_tracking_service
from models.smoking_tracking import ensure_all_smoking_indexes
import logging


def get_current_user_id():
    """Get the current authenticated user's ID from Firebase auth middleware"""
    return getattr(request, 'current_user_id', None)


# ==================== BASELINE ENDPOINTS ====================

def create_baseline():
    """
    Create manual baseline smoking input (required at onboarding).
    This can only be done once per user.
    
    Request Body:
    {
        "smoking_status": "never|former|current",
        "years_smoked": 10.5,
        "typical_cigarettes_per_day": 15,
        "quit_date": "2020-01-01",  // required for former smokers
        "start_smoking_age": 18      // optional
    }
    
    Response:
    {
        "success": true,
        "message": "Smoking baseline created successfully",
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
        if "smoking_status" not in data:
            return jsonify({
                "success": False,
                "error": "Missing required field: smoking_status"
            }), 400
        
        service = get_smoking_tracking_service()
        baseline = service.create_baseline(
            user_id=user_id,
            smoking_status=data["smoking_status"],
            years_smoked=float(data.get("years_smoked", 0)),
            typical_cigarettes_per_day=int(data.get("typical_cigarettes_per_day", 0)),
            quit_date=data.get("quit_date"),
            start_smoking_age=data.get("start_smoking_age")
        )
        
        return jsonify({
            "success": True,
            "message": "Smoking baseline created successfully",
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
            "error": "Failed to create smoking baseline"
        }), 500


def get_baseline():
    """
    Get user's smoking baseline.
    
    Response:
    {
        "success": true,
        "data": { ... baseline data ... },
        "has_baseline": true
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_smoking_tracking_service()
        
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
            "error": "Failed to get smoking baseline"
        }), 500


def update_baseline():
    """
    Update existing smoking baseline (retake questionnaire).
    
    Request Body:
    {
        "smoking_status": "never|former|current",
        "years_smoked": 10.5,
        "typical_cigarettes_per_day": 15,
        "quit_date": "2020-01-01",
        "start_smoking_age": 18
    }
    
    Response:
    {
        "success": true,
        "message": "Smoking baseline updated successfully",
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
        if "smoking_status" not in data:
            return jsonify({
                "success": False,
                "error": "Missing required field: smoking_status"
            }), 400
        
        service = get_smoking_tracking_service()
        baseline = service.update_baseline(
            user_id=user_id,
            smoking_status=data["smoking_status"],
            years_smoked=float(data.get("years_smoked", 0)),
            typical_cigarettes_per_day=int(data.get("typical_cigarettes_per_day", 0)),
            quit_date=data.get("quit_date"),
            start_smoking_age=data.get("start_smoking_age")
        )
        
        return jsonify({
            "success": True,
            "message": "Smoking baseline updated successfully",
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
            "error": "Failed to update smoking baseline"
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
        service = get_smoking_tracking_service()
        
        has_baseline = service.has_baseline(user_id)
        
        return jsonify({
            "success": True,
            "has_baseline": has_baseline
        }), 200
        
    except Exception as e:
        logging.error(f"Error checking baseline: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to check smoking baseline"
        }), 500


# ==================== DAILY RECORD ENDPOINTS ====================

def log_daily_smoking():
    """
    Log manual daily smoking record.
    
    Request Body:
    {
        "date": "2024-01-15",
        "cigarettes_count": 10,
        "notes": "Stressful day"  // optional
    }
    
    Response:
    {
        "success": true,
        "message": "Smoking record logged successfully",
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
        required_fields = ["date", "cigarettes_count"]
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        service = get_smoking_tracking_service()
        record = service.log_daily_smoking(
            user_id=user_id,
            date=data["date"],
            cigarettes_count=int(data["cigarettes_count"]),
            notes=data.get("notes")
        )
        
        return jsonify({
            "success": True,
            "message": "Smoking record logged successfully",
            "data": record
        }), 201
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logging.error(f"Error logging daily smoking: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to log smoking record"
        }), 500


def get_daily_records():
    """
    Get daily smoking records.
    
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
        
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        days = int(request.args.get("days", 30))
        
        service = get_smoking_tracking_service()
        records = service.get_daily_records(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            days=days
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
            "error": "Failed to get smoking records"
        }), 500


def delete_daily_record(date):
    """
    Delete daily smoking record for a specific date.
    
    Path Parameters:
    - date: Date to delete (YYYY-MM-DD)
    
    Response:
    {
        "success": true,
        "message": "Deleted 1 record(s)",
        "deleted": 1
    }
    """
    try:
        user_id = get_current_user_id()
        
        service = get_smoking_tracking_service()
        result = service.delete_daily_record(user_id, date)
        
        return jsonify({
            "success": True,
            "message": f"Deleted {result['deleted']} record(s)",
            "deleted": result['deleted']
        }), 200
        
    except Exception as e:
        logging.error(f"Error deleting daily record: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to delete smoking record"
        }), 500


# ==================== METRICS ENDPOINTS ====================

def get_metrics():
    """
    Get computed smoking metrics.
    
    Response:
    {
        "success": true,
        "data": {
            "avg_cigarettes_7d": 12.5,
            "avg_cigarettes_30d": 14.2,
            "cigarette_variability_30d": 3.5,
            "days_with_data_7d": 5,
            "days_with_data_30d": 22,
            "cumulative_pack_years": 15.5,
            "years_since_quit": null,
            "current_status": "current",
            "risk_category": "high",
            "risk_factors": [...],
            "risk_score": 4.0,
            "computed_at": "2024-01-15T10:30:00Z"
        }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_smoking_tracking_service()
        
        # Get metrics (compute if not exists)
        metrics = service.get_metrics(user_id)
        
        if not metrics:
            # Compute metrics
            metrics = service.compute_metrics(user_id)
        
        return jsonify({
            "success": True,
            "data": metrics
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting metrics: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get smoking metrics"
        }), 500


def refresh_metrics():
    """
    Force refresh smoking metrics.
    
    Response:
    {
        "success": true,
        "message": "Metrics refreshed successfully",
        "data": { ... metrics ... }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_smoking_tracking_service()
        
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
            "error": "Failed to refresh smoking metrics"
        }), 500


# ==================== RISK ASSESSMENT ENDPOINTS ====================

def get_risk_assessment():
    """
    Get latest risk assessment.
    
    Response:
    {
        "success": true,
        "data": {
            "risk_category": "high",
            "risk_score": 4.0,
            "risk_factors": [...],
            "explanation": "...",
            "recommendations": [...],
            "assessed_at": "2024-01-15T10:30:00Z"
        }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_smoking_tracking_service()
        
        assessment = service.get_risk_assessment(user_id)
        
        if not assessment:
            return jsonify({
                "success": False,
                "error": "No risk assessment found. Create baseline first."
            }), 404
        
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
        "count": 10
    }
    """
    try:
        user_id = get_current_user_id()
        limit = int(request.args.get("limit", 30))
        
        service = get_smoking_tracking_service()
        assessments = service.get_risk_history(user_id, limit)
        
        return jsonify({
            "success": True,
            "data": assessments,
            "count": len(assessments)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting risk history: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get risk history"
        }), 500


# ==================== SUMMARY ENDPOINT ====================

def get_smoking_summary():
    """
    Get comprehensive smoking tracking summary.
    
    Response:
    {
        "success": true,
        "data": {
            "has_baseline": true,
            "baseline": { ... },
            "recent_records": [ ... ],
            "metrics": { ... },
            "risk_assessment": { ... }
        }
    }
    """
    try:
        user_id = get_current_user_id()
        service = get_smoking_tracking_service()
        
        summary = service.get_smoking_summary(user_id)
        
        return jsonify({
            "success": True,
            "data": summary
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting smoking summary: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get smoking summary"
        }), 500


# ==================== INITIALIZATION ====================

def init_smoking_tracking_indexes():
    """Initialize database indexes for smoking tracking"""
    try:
        ensure_all_smoking_indexes()
        logging.info("Smoking tracking indexes initialized successfully")
    except Exception as e:
        logging.error(f"Error initializing smoking tracking indexes: {e}")
        raise
