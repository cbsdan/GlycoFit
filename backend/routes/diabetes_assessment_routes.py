from flask import Blueprint
from controllers.diabetes_assessment_controller import (
    submit_assessment,
    get_my_assessment,
    update_assessment_answers,
    delete_assessment
)
from middleware.firebase_auth import firebase_auth_required

# Create blueprint
diabetes_assessment_bp = Blueprint('diabetes_assessment', __name__)

# Routes with authentication
diabetes_assessment_bp.route('/submit', methods=['POST'])(firebase_auth_required(submit_assessment))
diabetes_assessment_bp.route('/my', methods=['GET'])(firebase_auth_required(get_my_assessment))
diabetes_assessment_bp.route('/update', methods=['PUT'])(firebase_auth_required(update_assessment_answers))
diabetes_assessment_bp.route('/delete', methods=['DELETE'])(firebase_auth_required(delete_assessment))
