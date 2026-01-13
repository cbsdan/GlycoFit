from flask import Blueprint, request
from middleware.firebase_auth import firebase_auth_required, get_current_user_id
from controllers.step_tracking_controller import StepTrackingController

step_tracking_bp = Blueprint('step_tracking', __name__)

# ==================== BASELINE ENDPOINTS ====================

@step_tracking_bp.route('/baseline', methods=['POST'])
@firebase_auth_required
def create_baseline():
    """Create initial step baseline (onboarding)"""
    user_id = get_current_user_id()
    return StepTrackingController.create_baseline(user_id)

@step_tracking_bp.route('/baseline', methods=['GET'])
@firebase_auth_required
def get_baseline():
    """Get user's step baseline"""
    user_id = get_current_user_id()
    return StepTrackingController.get_baseline(user_id)

@step_tracking_bp.route('/baseline/check', methods=['GET'])
@firebase_auth_required
def check_baseline():
    """Check if baseline exists"""
    user_id = get_current_user_id()
    return StepTrackingController.check_baseline(user_id)

@step_tracking_bp.route('/baseline', methods=['PUT'])
@firebase_auth_required
def update_baseline():
    """Update step baseline"""
    user_id = get_current_user_id()
    return StepTrackingController.update_baseline(user_id)

# ==================== METRICS ENDPOINTS ====================

@step_tracking_bp.route('/metrics', methods=['GET'])
@firebase_auth_required
def get_metrics():
    """Get computed step metrics"""
    user_id = get_current_user_id()
    return StepTrackingController.get_metrics(user_id)

@step_tracking_bp.route('/summary', methods=['GET'])
@firebase_auth_required
def get_summary():
    """Get comprehensive step summary"""
    user_id = get_current_user_id()
    days = request.args.get('days', default=7, type=int)
    return StepTrackingController.get_summary(user_id, days)