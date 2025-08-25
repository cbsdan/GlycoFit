from flask import Blueprint
from controllers.auth_controller import AuthController

auth_bp = Blueprint('auth', __name__)

# OTP Routes (no authentication required)
@auth_bp.route('/generate-otp', methods=['POST'])
def generate_otp():
    return AuthController.generate_and_send_otp()

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    return AuthController.verify_otp()

# Authentication Routes (Firebase UID based)
@auth_bp.route('/register', methods=['POST'])
def register():
    return AuthController.register_user()

@auth_bp.route('/get-user', methods=['POST'])
def get_user():
    return AuthController.get_user()

# Profile Management (requires Firebase authentication)
@auth_bp.route('/profile', methods=['PUT'])
def update_profile():
    return AuthController.update_my_profile()

# Admin Routes (requires Firebase admin authentication)
@auth_bp.route('/admin/users', methods=['GET'])
def get_all_users():
    return AuthController.get_all_users()

@auth_bp.route('/admin/users/<user_id>', methods=['GET'])
def get_user_details(user_id):
    return AuthController.get_user_details(user_id)

@auth_bp.route('/admin/users/<user_id>/disable', methods=['PUT'])
def disable_user(user_id):
    return AuthController.disable_user(user_id)

@auth_bp.route('/admin/users/<user_id>/enable', methods=['PUT'])
def enable_user(user_id):
    return AuthController.enable_user(user_id)
