from flask import Blueprint
from controllers.activity_controller import (
    save_daily_activity,
    save_exercise_session,
    get_activities,
    get_activity_summary,
    get_exercise_sessions
)
from middleware.firebase_auth import firebase_auth_required

activity_bp = Blueprint('activity', __name__)

# Apply firebase auth to all routes in this blueprint
@activity_bp.before_request
@firebase_auth_required
def before_activity_request():
    """Verify Firebase authentication for all activity routes"""
    pass

# Daily Activity Routes
@activity_bp.route('/daily', methods=['POST'])
def save_daily_activity_route():
    """
    Save or update daily activity data
    Expected payload:
    {
        "date": "2024-01-06T00:00:00.000Z",
        "steps": 5000,
        "distance": 3500,
        "active_calories": 250,
        "total_calories": 2000,
        "source": "health_connect" or "phone_sensor",
        "phoneSensorSteps": 5000,
        "healthConnectSteps": 5000,
        "streak": 5,
        "achievements": []
    }
    """
    return save_daily_activity()

@activity_bp.route('/activities', methods=['GET'])
def get_activities_route():
    """
    Get activity data for a date range
    Query params:
    - start_date (optional): ISO date string
    - end_date (optional): ISO date string
    Defaults to last 30 days if not provided
    """
    return get_activities()

@activity_bp.route('/summary', methods=['GET'])
def get_activity_summary_route():
    """
    Get activity summary statistics
    Query params:
    - start_date (optional): ISO date string
    - end_date (optional): ISO date string
    Defaults to last 7 days if not provided
    """
    return get_activity_summary()

# Exercise Session Routes
@activity_bp.route('/exercise', methods=['POST'])
def save_exercise_session_route():
    """
    Save a new exercise session
    Expected payload:
    {
        "exercise_type": "running",
        "start_time": "2024-01-06T08:00:00.000Z",
        "end_time": "2024-01-06T09:00:00.000Z",
        "duration": 60,
        "calories": 300,
        "distance": 5000
    }
    """
    return save_exercise_session()

@activity_bp.route('/exercise/sessions', methods=['GET'])
def get_exercise_sessions_route():
    """
    Get exercise sessions
    Query params:
    - start_time (optional): ISO timestamp
    - end_time (optional): ISO timestamp
    - limit (optional): max number of sessions (default: 50)
    Defaults to last 30 days if not provided
    """
    return get_exercise_sessions()
