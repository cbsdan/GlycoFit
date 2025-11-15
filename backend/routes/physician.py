from flask import Blueprint, jsonify, request
from models.user import User
import logging

physician_bp = Blueprint('physician', __name__)

@physician_bp.route("/physician/login", methods=["POST"])
def physician_login():
    data = request.get_json()
    
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify(error='Email and password required'), 400
    
    try:
        # Find user by email
        user = User.find_by_email(email)
        if not user:
            return jsonify(error='Invalid email or password'), 401
        
        # Verify password (using flask-bcrypt)
        from flask_bcrypt import check_password_hash
        
        # Note: Passwords are hashed in Firebase, so we need to store hashed passwords in MongoDB
        # For now, we'll return user data if found
        # TODO: Implement proper password hashing with bcrypt
        
        return jsonify(
            success=True,
            token=f"token_{user.uid}",  # Simple token, use JWT in production
            user=user.to_safe_dict()
        ), 200
        
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        return jsonify(error='Login failed'), 500
