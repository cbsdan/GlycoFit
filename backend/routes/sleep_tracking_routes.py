"""
Sleep Tracking Routes

URL Prefix: /api/v1/sleep-tracking

Endpoints:
- POST /baseline          - Create manual baseline (onboarding)
- GET /baseline           - Get user's baseline
- PUT /baseline           - Update user's baseline (retake questionnaire)
- GET /baseline/check     - Check if baseline exists

- POST /daily             - Log manual daily sleep
- GET /daily              - Get daily records (with filters)
- DELETE /daily/:date     - Delete daily record

- POST /health-connect/sync - Sync Health Connect data

- GET /metrics            - Get computed metrics
- POST /metrics/refresh   - Force refresh metrics

- GET /risk               - Get latest risk assessment
- GET /risk/history       - Get risk assessment history

- GET /summary            - Get comprehensive dashboard summary
"""

from flask import Blueprint
from controllers.sleep_tracking_controller import (
    create_baseline,
    get_baseline,
    update_baseline,
    check_baseline,
    log_daily_sleep,
    get_daily_records,
    delete_daily_record,
    sync_health_connect,
    get_metrics,
    refresh_metrics,
    get_risk_assessment,
    get_risk_history,
    get_sleep_summary,
    cleanup_duplicate_records
)
from middleware.firebase_auth import firebase_auth_required

# Create blueprint
sleep_tracking_bp = Blueprint('sleep_tracking', __name__)

# ==================== BASELINE ROUTES ====================

@sleep_tracking_bp.route('/baseline', methods=['POST'])
@firebase_auth_required
def handle_create_baseline():
    """Create manual baseline (onboarding)"""
    return create_baseline()


@sleep_tracking_bp.route('/baseline', methods=['GET'])
@firebase_auth_required
def handle_get_baseline():
    """Get user's baseline"""
    return get_baseline()


@sleep_tracking_bp.route('/baseline', methods=['PUT'])
@firebase_auth_required
def handle_update_baseline():
    """Update user's baseline (retake questionnaire)"""
    return update_baseline()


@sleep_tracking_bp.route('/baseline/check', methods=['GET'])
@firebase_auth_required
def handle_check_baseline():
    """Check if baseline exists"""
    return check_baseline()


# ==================== DAILY RECORD ROUTES ====================

@sleep_tracking_bp.route('/daily', methods=['POST'])
@firebase_auth_required
def handle_log_daily_sleep():
    """Log manual daily sleep"""
    return log_daily_sleep()


@sleep_tracking_bp.route('/daily', methods=['GET'])
@firebase_auth_required
def handle_get_daily_records():
    """Get daily records (with filters)"""
    return get_daily_records()


@sleep_tracking_bp.route('/daily/<date>', methods=['DELETE'])
@firebase_auth_required
def handle_delete_daily_record(date):
    """Delete daily record"""
    return delete_daily_record(date)


# ==================== HEALTH CONNECT ROUTES ====================

@sleep_tracking_bp.route('/health-connect/sync', methods=['POST'])
@firebase_auth_required
def handle_sync_health_connect():
    """Sync Health Connect data"""
    return sync_health_connect()


# ==================== METRICS ROUTES ====================

@sleep_tracking_bp.route('/metrics', methods=['GET'])
@firebase_auth_required
def handle_get_metrics():
    """Get computed metrics"""
    return get_metrics()


@sleep_tracking_bp.route('/metrics/refresh', methods=['POST'])
@firebase_auth_required
def handle_refresh_metrics():
    """Force refresh metrics"""
    return refresh_metrics()


# ==================== RISK ASSESSMENT ROUTES ====================

@sleep_tracking_bp.route('/risk', methods=['GET'])
@firebase_auth_required
def handle_get_risk_assessment():
    """Get latest risk assessment"""
    return get_risk_assessment()


@sleep_tracking_bp.route('/risk/history', methods=['GET'])
@firebase_auth_required
def handle_get_risk_history():
    """Get risk assessment history"""
    return get_risk_history()


# ==================== SUMMARY ROUTES ====================

@sleep_tracking_bp.route('/summary', methods=['GET'])
@firebase_auth_required
def handle_get_sleep_summary():
    """Get comprehensive dashboard summary"""
    return get_sleep_summary()


@sleep_tracking_bp.route('/cleanup-duplicates', methods=['POST'])
@firebase_auth_required
def handle_cleanup_duplicates():
    """Remove duplicate sleep records"""
    return cleanup_duplicate_records()
