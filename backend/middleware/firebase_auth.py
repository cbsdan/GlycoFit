from functools import wraps
from flask import request, jsonify
from config.firebase_admin import verify_firebase_token, get_firebase_user
from models.user import User
import logging

def firebase_auth_required(f):
    """Decorator to require Firebase authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get the Authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': 'Authorization header is required'}), 401
            
            # Extract the token (format: "Bearer <token>")
            try:
                token_type, token = auth_header.split(' ', 1)
                if token_type.lower() != 'bearer':
                    return jsonify({'error': 'Invalid authorization header format'}), 401
            except ValueError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
            
            # Verify the Firebase token
            try:
                decoded_token = verify_firebase_token(token)
                firebase_uid = decoded_token.get('uid')
                
                if not firebase_uid:
                    return jsonify({'error': 'Invalid token: no UID found'}), 401
                
                # Get user from our database using Firebase UID
                user = User.find_by_uid(firebase_uid)
                if not user:
                    return jsonify({'error': 'User not found in our system'}), 404
                
                # Check if user is disabled
                if user.is_currently_disabled():
                    disable_record = user.get_current_disable_record()
                    return jsonify({
                        'error': 'Account is disabled',
                        'disable_info': {
                            'reason': disable_record.get('reason'),
                            'is_permanent': disable_record.get('is_permanent'),
                            'end_date': disable_record.get('end_date').isoformat() if disable_record.get('end_date') else None
                        }
                    }), 403
                
                # Store user info in request context
                request.firebase_user = decoded_token
                request.current_user = user
                request.current_user_id = str(user._id)
                
                logging.info(f"Firebase authentication successful for user: {firebase_uid}")
                
            except Exception as e:
                logging.warning(f"Firebase token verification failed: {str(e)}")
                return jsonify({'error': 'Invalid or expired token'}), 401
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logging.error(f"Firebase authentication error: {str(e)}")
            return jsonify({'error': 'Authentication error'}), 500
    
    return decorated_function

def firebase_admin_required(f):
    """Decorator to require Firebase authentication and admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # First check Firebase authentication
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': 'Authorization header is required'}), 401
            
            try:
                token_type, token = auth_header.split(' ', 1)
                if token_type.lower() != 'bearer':
                    return jsonify({'error': 'Invalid authorization header format'}), 401
            except ValueError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
            
            # Verify the Firebase token
            try:
                decoded_token = verify_firebase_token(token)
                firebase_uid = decoded_token.get('uid')
                
                if not firebase_uid:
                    return jsonify({'error': 'Invalid token: no UID found'}), 401
                
                # Get user from our database
                user = User.find_by_uid(firebase_uid)
                if not user:
                    return jsonify({'error': 'User not found in our system'}), 404
                
                # Check if user is admin
                if user.role != 'admin':
                    return jsonify({'error': 'Admin access required'}), 403
                
                # Check if user is disabled
                if user.is_currently_disabled():
                    return jsonify({'error': 'Admin account is disabled'}), 403
                
                # Store user info in request context
                request.firebase_user = decoded_token
                request.current_user = user
                request.current_user_id = str(user._id)
                
                logging.info(f"Firebase admin authentication successful for user: {firebase_uid}")
                
            except Exception as e:
                logging.warning(f"Firebase admin token verification failed: {str(e)}")
                return jsonify({'error': 'Invalid or expired token'}), 401
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logging.error(f"Firebase admin authentication error: {str(e)}")
            return jsonify({'error': 'Authentication error'}), 500
    
    return decorated_function

def get_current_user():
    """Helper function to get current authenticated user"""
    return getattr(request, 'current_user', None)

def get_current_user_id():
    """Helper function to get current authenticated user ID"""
    return getattr(request, 'current_user_id', None)

def get_firebase_user_data():
    """Helper function to get Firebase user data from token"""
    return getattr(request, 'firebase_user', None)
