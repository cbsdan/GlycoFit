from flask import Blueprint, request, jsonify
from models.user import User
import logging
from datetime import datetime, timedelta

users_bp = Blueprint('users_blueprint', __name__, url_prefix='/api/users')

@users_bp.route('', methods=['GET'])
def get_all_users():
    """Get all users with pagination"""
    try:
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 50, type=int)
        
        users = User.get_all_users(skip=skip, limit=limit)
        users_data = [user.to_safe_dict() for user in users]
        
        return jsonify({
            'status': 'success',
            'users': users_data,
            'count': len(users_data)
        }), 200
    except Exception as e:
        logging.error(f"Error fetching users: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@users_bp.route('', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400
        
        required_fields = ['uid', 'first_name', 'last_name', 'email']
        if not all(field in data for field in required_fields):
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400
        
        # Check if user already exists
        existing_user = User.find_by_email(data['email'])
        if existing_user:
            return jsonify({'status': 'error', 'message': 'User already exists'}), 409
        
        user = User(
            uid=data['uid'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            avatar=data.get('avatar'),
            role=data.get('role', 'user')
        )
        
        user.save()
        
        return jsonify({
            'status': 'success',
            'message': 'User created successfully',
            'user': user.to_safe_dict()
        }), 201
    except Exception as e:
        logging.error(f"Error creating user: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@users_bp.route('/<user_id>', methods=['GET'])
def get_user(user_id):
    """Get user by ID"""
    try:
        user = User.find_by_id(user_id)
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        return jsonify({
            'status': 'success',
            'user': user.to_safe_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error fetching user: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@users_bp.route('/<user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user profile"""
    try:
        data = request.get_json()
        user = User.find_by_id(user_id)
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        user.update_profile(**data)
        user.save()
        
        return jsonify({
            'status': 'success',
            'message': 'User updated successfully',
            'user': user.to_safe_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error updating user: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@users_bp.route('/<user_id>/disable/', methods=['POST'])
@users_bp.route('/<user_id>/disable', methods=['POST'])
def disable_user(user_id):
    """Disable a user"""
    try:
        data = request.get_json() or {}
        user = User.find_by_id(user_id)
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        reason = data.get('reason', 'Admin disabled')
        is_permanent = data.get('is_permanent', False)
        days = data.get('days', 7)
        end_date = None
        
        # Calculate end_date if not permanent
        if not is_permanent:
            end_date = datetime.utcnow() + timedelta(days=days)
        
        user.add_disable_record(
            reason=reason,
            end_date=end_date,
            is_permanent=is_permanent
        )
        user.save()
        
        logging.info(f"User {user_id} disabled: {reason}")
        
        return jsonify({
            'status': 'success',
            'message': 'User disabled successfully',
            'user': user.to_safe_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error disabling user: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@users_bp.route('/<user_id>/enable/', methods=['POST'])
@users_bp.route('/<user_id>/enable', methods=['POST'])
def enable_user(user_id):
    """Enable a disabled user"""
    try:
        data = request.get_json() or {}
        user = User.find_by_id(user_id)
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        if not user.is_currently_disabled():
            return jsonify({'status': 'error', 'message': 'User is not disabled'}), 400
        
        user.enable_user(reason=data.get('reason', 'User enabled by admin'))
        user.save()
        
        logging.info(f"User {user_id} enabled")
        
        return jsonify({
            'status': 'success',
            'message': 'User enabled successfully',
            'user': user.to_safe_dict()
        }), 200
    except Exception as e:
        logging.error(f"Error enabling user: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@users_bp.route('/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user"""
    try:
        from config.database import get_db
        from bson import ObjectId
        
        db = get_db()
        result = db.users.delete_one({'_id': ObjectId(user_id)})
        
        if result.deleted_count == 0:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        return jsonify({
            'status': 'success',
            'message': 'User deleted successfully'
        }), 200
    except Exception as e:
        logging.error(f"Error deleting user: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
