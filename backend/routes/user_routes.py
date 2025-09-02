from flask import Blueprint
from controllers.auth_controller import AuthController
from controllers.user_info_controller import UserInfoController
from controllers.nutrient_controller import NutrientController

user_bp = Blueprint('users', __name__)

# Profile Routes
@user_bp.route('/profile', methods=['GET'])
def get_profile():
    # This will be handled by JWT middleware
    pass

@user_bp.route('/profile', methods=['PUT'])
def update_profile():
    return AuthController.update_my_profile()

# User Info Routes
@user_bp.route('/user-info', methods=['GET'])
def get_all_user_info():
    return UserInfoController.get_all_user_info()

@user_bp.route('/user-info/<info_user_id>', methods=['GET'])
def get_user_info(info_user_id):
    return UserInfoController.get_user_info(info_user_id)

@user_bp.route('/user-info', methods=['POST'])
def create_user_info():
    return UserInfoController.create_user_info()

@user_bp.route('/user-info/<info_id>', methods=['PUT'])
def update_user_info(info_id):
    return UserInfoController.update_user_info(info_id)

@user_bp.route('/user-info/<info_id>', methods=['DELETE'])
def delete_user_info(info_id):
    return UserInfoController.delete_user_info(info_id)


# Meal Management Routes
@user_bp.route('/meals', methods=['GET'])
def get_user_meals():
    """Get user's meal history"""
    return NutrientController.get_user_meals()

@user_bp.route('/meals/<meal_id>', methods=['GET'])
def get_meal_by_id(meal_id):
    """Get a specific meal by ID"""
    return NutrientController.get_meal_by_id(meal_id)

@user_bp.route('/meals/<meal_id>', methods=['PUT'])
def update_meal(meal_id):
    """Update meal details"""
    return NutrientController.update_meal(meal_id)

@user_bp.route('/meals/<meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    """Delete a meal record"""
    return NutrientController.delete_meal(meal_id)

@user_bp.route('/nutrition-summary', methods=['GET'])
def get_nutrition_summary():
    """Get nutrition summary for the user"""
    return NutrientController.get_nutrition_summary()
