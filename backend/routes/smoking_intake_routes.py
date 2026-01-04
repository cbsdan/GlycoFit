from flask import Blueprint
from controllers.smoking_intake_controller import (
    save_smoking_intake,
    get_smoking_intake,
    get_smoking_intake_history,
    get_latest_smoking_intake,
    get_smoking_statistics,
    delete_smoking_intake,
    delete_smoking_session
)
from middleware.firebase_auth import firebase_auth_required

smoking_intake_bp = Blueprint('smoking_intake', __name__)

# Save/update smoking intake record
@smoking_intake_bp.route('', methods=['POST'])
@firebase_auth_required
def save_smoking_intake_route():
    """
    Save or update smoking intake record
    
    Request Body:
    {
        "smoking_status": "never|former|current",
        "cigarettes_per_day": "0|1-5|6-10|11-20|>20",
        "years_smoked": 0,
        "pack_years": 0,
        "start_date": "2020-01-01" (optional)
    }
    """
    return save_smoking_intake()

# Get smoking intake record
@smoking_intake_bp.route('', methods=['GET'])
@firebase_auth_required
def get_smoking_intake_route():
    """
    Get smoking intake record for authenticated user
    """
    return get_smoking_intake()

# Get smoking intake history (returns single record with sessions for backward compatibility)
@smoking_intake_bp.route('/history', methods=['GET'])
@firebase_auth_required
def get_smoking_intake_history_route():
    """
    Get smoking intake record with session history for authenticated user
    """
    return get_smoking_intake_history()

# Get latest smoking intake record
@smoking_intake_bp.route('/latest', methods=['GET'])
@firebase_auth_required
def get_latest_smoking_intake_route():
    """
    Get the smoking intake record for authenticated user
    """
    return get_latest_smoking_intake()

# Get smoking statistics with diabetes risk
@smoking_intake_bp.route('/statistics', methods=['GET'])
@firebase_auth_required
def get_smoking_statistics_route():
    """
    Get smoking intake statistics with diabetes risk for authenticated user
    """
    return get_smoking_statistics()

# Delete entire smoking intake record
@smoking_intake_bp.route('', methods=['DELETE'])
@firebase_auth_required
def delete_smoking_intake_route():
    """
    Delete entire smoking intake record for authenticated user
    """
    return delete_smoking_intake()

# Delete a specific smoking session
@smoking_intake_bp.route('/session/<session_id>', methods=['DELETE'])
@firebase_auth_required
def delete_smoking_session_route(session_id):
    """
    Delete a specific smoking session
    
    Path Parameters:
    - session_id: ID of the smoking session to delete
    """
    return delete_smoking_session(session_id)
