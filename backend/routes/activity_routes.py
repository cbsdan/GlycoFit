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

# Save daily activity
@activity_bp.route('/daily', methods=['POST'])
@firebase_auth_required
def save_daily_activity_route():
    return save_daily_activity()

# Save exercise session
@activity_bp.route('/exercise', methods=['POST'])
@firebase_auth_required
def save_exercise_session_route():
    return save_exercise_session()

# Get activities
@activity_bp.route('/list', methods=['GET'])
@firebase_auth_required
def get_activities_route():
    return get_activities()

# Get activity summary
@activity_bp.route('/summary', methods=['GET'])
@firebase_auth_required
def get_activity_summary_route():
    return get_activity_summary()

# Get exercise sessions
@activity_bp.route('/exercise/list', methods=['GET'])
@firebase_auth_required
def get_exercise_sessions_route():
    return get_exercise_sessions()