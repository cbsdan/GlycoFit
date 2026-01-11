"""
Smoking Tracking Routes

URL Prefix: /api/v1/smoking-tracking

Endpoints:
- POST /baseline          - Create manual baseline (onboarding)
- GET /baseline           - Get user's baseline
- PUT /baseline           - Update user's baseline (retake questionnaire)
- GET /baseline/check     - Check if baseline exists

- POST /daily             - Log manual daily smoking
- GET /daily              - Get daily records (with filters)
- DELETE /daily/:date     - Delete daily record

- GET /metrics            - Get computed metrics
- POST /metrics/refresh   - Force refresh metrics

- GET /risk               - Get latest risk assessment
- GET /risk/history       - Get risk assessment history

- GET /summary            - Get comprehensive dashboard summary
"""

from flask import Blueprint
from controllers.smoking_tracking_controller import (
    create_baseline,
    get_baseline,
    update_baseline,
    check_baseline,
    log_daily_smoking,
    get_daily_records,
    delete_daily_record,
    get_metrics,
    refresh_metrics,
    get_risk_assessment,
    get_risk_history,
    get_smoking_summary
)
from middleware.firebase_auth import firebase_auth_required

# Create blueprint
smoking_tracking_bp = Blueprint('smoking_tracking', __name__)

# ==================== BASELINE ROUTES ====================

@smoking_tracking_bp.route('/baseline', methods=['POST'])
@firebase_auth_required
def handle_create_baseline():
    """Create manual baseline (onboarding)"""
    return create_baseline()


@smoking_tracking_bp.route('/baseline', methods=['GET'])
@firebase_auth_required
def handle_get_baseline():
    """Get user's baseline"""
    return get_baseline()


@smoking_tracking_bp.route('/baseline', methods=['PUT'])
@firebase_auth_required
def handle_update_baseline():
    """Update user's baseline (retake questionnaire)"""
    return update_baseline()


@smoking_tracking_bp.route('/baseline/check', methods=['GET'])
@firebase_auth_required
def handle_check_baseline():
    """Check if baseline exists"""
    return check_baseline()


# ==================== DAILY RECORD ROUTES ====================

@smoking_tracking_bp.route('/daily', methods=['POST'])
@firebase_auth_required
def handle_log_daily_smoking():
    """Log manual daily smoking"""
    return log_daily_smoking()


@smoking_tracking_bp.route('/daily', methods=['GET'])
@firebase_auth_required
def handle_get_daily_records():
    """Get daily records (with filters)"""
    return get_daily_records()


@smoking_tracking_bp.route('/daily/<date>', methods=['DELETE'])
@firebase_auth_required
def handle_delete_daily_record(date):
    """Delete daily record"""
    return delete_daily_record(date)


# ==================== METRICS ROUTES ====================

@smoking_tracking_bp.route('/metrics', methods=['GET'])
@firebase_auth_required
def handle_get_metrics():
    """Get computed metrics"""
    return get_metrics()


@smoking_tracking_bp.route('/metrics/refresh', methods=['POST'])
@firebase_auth_required
def handle_refresh_metrics():
    """Force refresh metrics"""
    return refresh_metrics()


# ==================== RISK ASSESSMENT ROUTES ====================

@smoking_tracking_bp.route('/risk', methods=['GET'])
@firebase_auth_required
def handle_get_risk_assessment():
    """Get latest risk assessment"""
    return get_risk_assessment()


@smoking_tracking_bp.route('/risk/history', methods=['GET'])
@firebase_auth_required
def handle_get_risk_history():
    """Get risk assessment history"""
    return get_risk_history()


# ==================== SUMMARY ROUTES ====================

@smoking_tracking_bp.route('/summary', methods=['GET'])
@firebase_auth_required
def handle_get_smoking_summary():
    """Get comprehensive dashboard summary"""
    return get_smoking_summary()
