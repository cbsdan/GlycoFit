"""
Alcohol Intake Routes

REST API endpoints for tracking alcohol consumption and diabetes risk assessment.
Following the sleep tracking pattern with baseline + daily logs.
"""

from flask import Blueprint
from controllers.alcohol_intake_controller import (
    create_baseline,
    get_baseline,
    update_baseline,
    check_baseline,
    log_daily_alcohol,
    get_daily_records,
    delete_daily_record,
    get_metrics,
    refresh_metrics,
    get_risk_assessment,
    get_alcohol_summary
)
from middleware.firebase_auth import firebase_auth_required

# Create Blueprint
alcohol_intake_bp = Blueprint('alcohol_intake', __name__)

# ==================== BASELINE ROUTES ====================

@alcohol_intake_bp.route('/baseline', methods=['POST'])
@firebase_auth_required
def handle_create_baseline():
    """Create alcohol baseline (onboarding)"""
    return create_baseline()


@alcohol_intake_bp.route('/baseline', methods=['GET'])
@firebase_auth_required
def handle_get_baseline():
    """Get user's baseline"""
    return get_baseline()


@alcohol_intake_bp.route('/baseline', methods=['PUT'])
@firebase_auth_required
def handle_update_baseline():
    """Update user's baseline (retake questionnaire)"""
    return update_baseline()


@alcohol_intake_bp.route('/baseline/check', methods=['GET'])
@firebase_auth_required
def handle_check_baseline():
    """Check if baseline exists"""
    return check_baseline()


# ==================== DAILY RECORD ROUTES ====================

@alcohol_intake_bp.route('/daily', methods=['POST'])
@firebase_auth_required
def handle_log_daily_alcohol():
    """Log daily alcohol consumption"""
    return log_daily_alcohol()


@alcohol_intake_bp.route('/daily', methods=['GET'])
@firebase_auth_required
def handle_get_daily_records():
    """Get daily records (with filters)"""
    return get_daily_records()


@alcohol_intake_bp.route('/daily/<date>', methods=['DELETE'])
@firebase_auth_required
def handle_delete_daily_record(date):
    """Delete daily record"""
    return delete_daily_record(date)


# ==================== METRICS ROUTES ====================

@alcohol_intake_bp.route('/metrics', methods=['GET'])
@firebase_auth_required
def handle_get_metrics():
    """Get computed metrics"""
    return get_metrics()


@alcohol_intake_bp.route('/metrics/refresh', methods=['POST'])
@firebase_auth_required
def handle_refresh_metrics():
    """Force refresh metrics"""
    return refresh_metrics()


# ==================== RISK ASSESSMENT ROUTES ====================

@alcohol_intake_bp.route('/risk', methods=['GET'])
@firebase_auth_required
def handle_get_risk_assessment():
    """Get latest risk assessment"""
    return get_risk_assessment()


# ==================== SUMMARY ROUTES ====================

@alcohol_intake_bp.route('/summary', methods=['GET'])
@firebase_auth_required
def handle_get_summary():
    """Get comprehensive dashboard summary"""
    return get_alcohol_summary()


# ==================== LEGACY/DEPRECATED ROUTES (for backward compatibility) ====================
# These routes redirect old single-assessment API to new baseline+daily pattern

@alcohol_intake_bp.route('/', methods=['POST', 'PUT'])
@firebase_auth_required
def handle_legacy_create_or_update():
    """DEPRECATED: Use /baseline and /daily instead. Returns summary for compatibility."""
    return get_alcohol_summary()


@alcohol_intake_bp.route('/', methods=['GET'])
@firebase_auth_required
def handle_legacy_get():
    """DEPRECATED: Use /summary instead"""
    return get_alcohol_summary()


@alcohol_intake_bp.route('/history', methods=['GET'])
@firebase_auth_required
def handle_legacy_history():
    """DEPRECATED: Use /daily for records"""
    return get_daily_records()


@alcohol_intake_bp.route('/risk-assessment', methods=['GET'])
@firebase_auth_required
def handle_legacy_risk_assessment():
    """DEPRECATED: Use /risk instead"""
    return get_risk_assessment()

