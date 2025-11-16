from flask import Blueprint, jsonify, request
from models.user import User
from models.user_meal import UserMeal
from datetime import datetime, timedelta
import logging

admin_bp = Blueprint('admin_blueprint', __name__)

@admin_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(status='ok', message='Admin routes are working')

@admin_bp.route("/users", methods=["GET"])
def get_all_users():
    try:
        logging.info("=== [ADMIN] Fetching all users ===")
        
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 50, type=int)
        
        users = User.get_all_users(skip=skip, limit=limit)
        logging.info(f"[ADMIN] Found {len(users)} users in database")
        
        users_data = []
        for idx, u in enumerate(users):
            try:
                user_dict = u.to_safe_dict()
                users_data.append(user_dict)
                if idx == 0:
                    logging.info(f"[ADMIN] Sample user 0: {user_dict}")
            except Exception as e:
                logging.error(f"[ADMIN] Error converting user {idx}: {str(e)}", exc_info=True)
                continue
        
        logging.info(f"[ADMIN] Successfully returning {len(users_data)} users")
        return jsonify(users=users_data, total=len(users_data))
        
    except Exception as e:
        logging.error(f"[ADMIN] Error in get_all_users: {str(e)}", exc_info=True)
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify(error=f"Failed to fetch users: {str(e)}", details=traceback.format_exc()), 500

@admin_bp.route("/users/stats", methods=["GET"])
def get_users_stats():
    """Get user statistics"""
    try:
        users = User.get_all_users()
        total_users = len(users)
        physicians = sum(1 for u in users if u.role == 'physician')
        disabled_users = sum(1 for u in users if u.is_currently_disabled())
        
        return jsonify({
            'total_users': total_users,
            'physicians': physicians,
            'regular_users': total_users - physicians,
            'disabled_users': disabled_users,
            'active_users': total_users - disabled_users
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error getting user stats: {str(e)}")
        return jsonify(error=str(e)), 500

@admin_bp.route("/users/create", methods=["POST"])
def create_user():
    from firebase_admin import auth
    
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['first_name', 'last_name', 'email', 'password', 'role']
    if not all(field in data for field in required_fields):
        return jsonify(error='Missing required fields'), 400
    
    email = data['email'].lower().strip()
    first_name = data['first_name'].strip()
    last_name = data['last_name'].strip()
    role = data['role'].strip()
    password = data['password']
    
    # Validate role
    if role not in ['user', 'physician', 'admin']:
        return jsonify(error='Invalid role'), 400
    
    # Check if user already exists in MongoDB
    existing_user = User.find_by_email(email)
    if existing_user:
        return jsonify(error='User with this email already exists'), 400
    
    # Validate password length
    if len(password) < 6:
        return jsonify(error='Password must be at least 6 characters'), 400
    
    try:
        # Create user in Firebase
        firebase_user = auth.create_user(
            email=email,
            password=password,
            display_name=f"{first_name} {last_name}"
        )
        
        # Set custom claims for role
        auth.set_custom_user_claims(firebase_user.uid, {'role': role})
        
        # Create user record in MongoDB
        user = User(
            uid=firebase_user.uid,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=role
        )
        user.save()
        
        logging.info(f"New {role} created: {email}")
        
        return jsonify(
            success=True,
            message=f'{role.capitalize()} created successfully',
            user=user.to_safe_dict()
        ), 201
        
    except auth.EmailAlreadyExistsError:
        return jsonify(error='Email already registered in Firebase'), 400
    except Exception as e:
        logging.error(f"Error creating user: {str(e)}")
        return jsonify(error=f'Failed to create user: {str(e)}'), 500

@admin_bp.route("/users/<user_id>/meals", methods=["GET"])
def get_user_meals_by_id(user_id):
    """Get meals for a user by MongoDB user ID"""
    try:
        user = User.find_by_id(user_id)
        if not user:
            return jsonify(error='User not found'), 404
        
        result = UserMeal.get_user_meals(user._id)
        if result.get('success'):
            return jsonify(
                status='success',
                meals=result['meals'],
                count=result.get('count', 0)
            ), 200
        else:
            return jsonify(
                status='error',
                error=result.get('error', 'Unknown error')
            ), 400
    except Exception as e:
        logging.error(f"Error getting user meals: {str(e)}")
        return jsonify(status='error', error=str(e)), 500

@admin_bp.route("/users/<uid>/meals", methods=["GET"])
def get_user_meals(uid):
    user = User.find_by_uid(uid)
    if not user:
        return jsonify(error='User not found'), 404
    
    result = UserMeal.get_user_meals(user._id)
    if result.get('success'):
        return jsonify(meals=result['meals'], count=result.get('count', 0))
    else:
        return jsonify(error=result.get('error', 'Unknown error')), 400

@admin_bp.route("/users/<uid>/disable", methods=["POST"])
def disable_user(uid):
    data = request.get_json()
    reason = data.get('reason', 'User disabled by admin')
    is_permanent = data.get('is_permanent', False)
    days = data.get('days', 7)
    
    user = User.find_by_uid(uid)
    if not user:
        return jsonify(error='User not found'), 404
    
    end_date = None if is_permanent else datetime.utcnow() + timedelta(days=days)
    user.add_disable_record(reason, end_date, is_permanent)
    user.save()
    
    return jsonify(success=True, message='User disabled successfully')

@admin_bp.route("/users/<uid>/enable", methods=["POST"])
def enable_user(uid):
    data = request.get_json()
    reason = data.get('reason', 'User enabled by admin')
    
    user = User.find_by_uid(uid)
    if not user:
        return jsonify(error='User not found'), 404
    
    user.enable_user(reason)
    user.save()
    
    return jsonify(success=True, message='User enabled successfully')

@admin_bp.route("/meals/<meal_id>", methods=["DELETE"])
def delete_meal(meal_id):
    """Delete a meal"""
    try:
        success = UserMeal.delete_meal(meal_id)
        if success:
            return jsonify(
                status='success',
                message='Meal deleted successfully'
            ), 200
        else:
            return jsonify(
                status='error',
                error='Meal not found'
            ), 404
    except Exception as e:
        logging.error(f"Error deleting meal: {str(e)}")
        return jsonify(status='error', error=str(e)), 500
