from flask import Blueprint
from controllers.heart_rate_controller import HeartRateController

heart_rate_bp = Blueprint('heart_rates', __name__)

# Heart Rate CRUD Routes
@heart_rate_bp.route('/', methods=['POST'])
def create_heart_rate():
    """Create a new heart rate record"""
    return HeartRateController.create_heart_rate()

@heart_rate_bp.route('/', methods=['GET'])
def get_heart_rates():
    """Get heart rate records with pagination"""
    return HeartRateController.get_heart_rates()

@heart_rate_bp.route('/<heart_rate_id>', methods=['GET'])
def get_heart_rate_by_id(heart_rate_id):
    """Get a specific heart rate record by ID"""
    return HeartRateController.get_heart_rate_by_id(heart_rate_id)

@heart_rate_bp.route('/<heart_rate_id>', methods=['PUT'])
def update_heart_rate(heart_rate_id):
    """Update a heart rate record"""
    return HeartRateController.update_heart_rate(heart_rate_id)

@heart_rate_bp.route('/<heart_rate_id>', methods=['DELETE'])
def delete_heart_rate(heart_rate_id):
    """Delete a heart rate record"""
    return HeartRateController.delete_heart_rate(heart_rate_id)

# Additional Heart Rate Routes
@heart_rate_bp.route('/latest', methods=['GET'])
def get_latest_heart_rate():
    """Get the latest heart rate record"""
    return HeartRateController.get_latest_heart_rate()

@heart_rate_bp.route('/statistics', methods=['GET'])
def get_heart_rate_statistics():
    """Get heart rate statistics"""
    return HeartRateController.get_heart_rate_statistics()

@heart_rate_bp.route('/date-range', methods=['GET'])
def get_heart_rates_by_date_range():
    """Get heart rate records within a date range"""
    return HeartRateController.get_heart_rates_by_date_range()
