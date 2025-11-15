from flask import Blueprint, jsonify, request
from models.user import User
from config.firebase_admin import FirebaseAuth
import logging

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route("/login", methods=["POST"])
def login():
    """General login endpoint for all users"""
    try:
        data = request.get_json()
        id_token = data.get('id_token')
        
        if not id_token:
            return jsonify(error='ID token is required'), 400
        
        # Verify Firebase token
        decoded_token = FirebaseAuth.verify_id_token(id_token)
        uid = decoded_token.get('uid')
        
        # Find user in MongoDB
        user = User.find_by_uid(uid)
        if not user:
            return jsonify(error='User not found'), 404
        
        # Check if user is disabled
        if user.is_currently_disabled():
            return jsonify(error='Your account has been disabled'), 403
        
        # Return user info with role
        return jsonify({
            'success': True,
            'user': user.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        return jsonify(error='Authentication failed'), 401

@auth_bp.route("/physician/login", methods=["POST"])
def physician_login():
    """Physician-specific login endpoint - only allows physicians"""
    try:
        data = request.get_json()
        id_token = data.get('id_token')
        
        if not id_token:
            return jsonify(error='ID token is required'), 400
        
        # Verify Firebase token
        decoded_token = FirebaseAuth.verify_id_token(id_token)
        uid = decoded_token.get('uid')
        
        # Find user in MongoDB
        user = User.find_by_uid(uid)
        if not user:
            return jsonify(error='User not found'), 404
        
        # Check if user is a physician
        if user.role != 'physician':
            logging.warning(f"Non-physician attempted to access physician app: {uid}")
            return jsonify(error='Access denied: Not a physician account'), 403
        
        # Check if user is disabled
        if user.is_currently_disabled():
            return jsonify(error='Your account has been disabled'), 403
        
        # Return physician info
        return jsonify({
            'success': True,
            'physician': user.to_safe_dict(),
            'message': 'Physician login successful'
        }), 200
        
    except Exception as e:
        logging.error(f"Physician login error: {str(e)}")
        return jsonify(error='Authentication failed'), 401

@auth_bp.route("/verify", methods=["POST"])
def verify_token():
    """Verify if a token is valid and return user info"""
    try:
        data = request.get_json()
        id_token = data.get('id_token')
        
        if not id_token:
            return jsonify(error='ID token is required'), 400
        
        # Verify Firebase token
        decoded_token = FirebaseAuth.verify_id_token(id_token)
        uid = decoded_token.get('uid')
        
        # Find user in MongoDB
        user = User.find_by_uid(uid)
        if not user:
            return jsonify(error='User not found'), 404
        
        return jsonify({
            'success': True,
            'user': user.to_safe_dict(),
            'valid': True
        }), 200
        
    except Exception as e:
        logging.error(f"Token verification error: {str(e)}")
        return jsonify(error='Invalid token', valid=False), 401
