from flask import Blueprint
from controllers.health_data_controller import HealthDataController
from middleware.firebase_auth import firebase_auth_required
from flask import g

health_data_bp = Blueprint('health_data', __name__)

@health_data_bp.before_request
@firebase_auth_required
def before_health_data_request():
    """Set up g.current_user for all health data routes"""
    from flask import request
    g.current_user = getattr(request, 'current_user', None)

# Sync Routes
@health_data_bp.route('/sync', methods=['POST'])
def sync_health_data():
    """Sync health data from mobile device"""
    return HealthDataController.sync_health_data()

@health_data_bp.route('/latest-sync', methods=['GET'])
def get_latest_sync():
    """Get latest sync timestamps for each data type"""
    return HealthDataController.get_latest_sync()

# Data Retrieval Routes
@health_data_bp.route('/', methods=['GET'])
def get_health_data():
    """Get health data with optional filters (data_type, start_date, end_date)"""
    return HealthDataController.get_health_data()

# Statistics Routes
@health_data_bp.route('/statistics/daily', methods=['GET'])
def get_daily_statistics():
    """Get daily statistics for a specific data type"""
    return HealthDataController.get_daily_statistics()

@health_data_bp.route('/statistics/weekly', methods=['GET'])
def get_weekly_statistics():
    """Get weekly statistics for a specific data type"""
    return HealthDataController.get_weekly_statistics()

@health_data_bp.route('/statistics/monthly', methods=['GET'])
def get_monthly_statistics():
    """Get monthly statistics for a specific data type"""
    return HealthDataController.get_monthly_statistics()

@health_data_bp.route('/statistics/summary', methods=['GET'])
def get_statistics_summary():
    """Get summary statistics for all data types (day/week/month)"""
    return HealthDataController.get_statistics_summary()
