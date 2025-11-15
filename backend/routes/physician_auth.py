from flask import Blueprint, jsonify, request
from models.user import User
from flask_jwt_extended import create_access_token
import logging

physician_auth_bp = Blueprint('physician_auth', __name__)

@physician_auth_bp.route("/physician/login", methods=["POST"])
def physician_login():
    """Login endpoint for physicians"""
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify(error='Email and password are required'), 400
    
    try:
        user = User.find_by_email(email)
        
        if not user:
            return jsonify(error='Invalid email or password'), 401
        
        # Check if user is a physician
        if user.role != 'physician':
            return jsonify(error='Only physicians can access this portal'), 403
        
        # Check if user is disabled
        if user.is_currently_disabled():
            return jsonify(error='Your account has been disabled'), 403
        
        # Check password
        if not user.check_password(password):
            return jsonify(error='Invalid email or password'), 401
        
        # Generate JWT token
        access_token = create_access_token(identity=user.uid)
        
        logging.info(f"Physician {email} logged in successfully")
        
        return jsonify(
            success=True,
            access_token=access_token,
            user={
                'uid': user.uid,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'role': user.role,
                'avatar': user.avatar
            }
        ), 200
        
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        return jsonify(error='Login failed'), 500

@physician_auth_bp.route("/physician/register", methods=["POST"])
def physician_register():
    """Register endpoint for physicians (admin only)"""
    data = request.get_json()
    
    required_fields = ['uid', 'first_name', 'last_name', 'email', 'password']
    if not all(field in data for field in required_fields):
        return jsonify(error='Missing required fields'), 400
    
    try:
        # Check if user already exists
        existing_user = User.find_by_email(data['email'])
        if existing_user:
            return jsonify(error='Email already registered'), 409
        
        # Create new physician user
        user = User(
            uid=data['uid'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            role='physician'
        )
        user.set_password(data['password'])
        user.save()
        
        logging.info(f"Physician {data['email']} registered successfully")
        
        return jsonify(
            success=True,
            message='Physician registered successfully',
            user=user.to_safe_dict()
        ), 201
        
    except Exception as e:
        logging.error(f"Registration error: {str(e)}")
        return jsonify(error='Registration failed'), 500
