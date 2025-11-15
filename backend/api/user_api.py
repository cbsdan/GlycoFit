from flask import Blueprint, jsonify, request
from models.user import User

user_api = Blueprint('user_api', __name__)

@user_api.route('/users', methods=['GET'])
def get_users():
    users = User.get_all_users()
    return jsonify([u.to_safe_dict() for u in users])

@user_api.route('/users/<user_id>/disable', methods=['POST'])
def disable_user(user_id):
    data = request.json or {}
    reason = data.get('reason', 'Disabled by admin')
    is_permanent = data.get('is_permanent', True)
    end_date = data.get('end_date')
    success = User.disable_user_by_id(user_id, reason, end_date, is_permanent)
    return jsonify({'success': success})

@user_api.route('/users/<user_id>/enable', methods=['POST'])
def enable_user(user_id):
    reason = request.json.get('reason', 'Enabled by admin') if request.json else 'Enabled by admin'
    success = User.enable_user_by_id(user_id, reason)
    return jsonify({'success': success})
