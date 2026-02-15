"""
Lifestyle Recommendation Routes

API routes for unified lifestyle recommendations and timeline predictions.
"""

from flask import Blueprint
from controllers.lifestyle_recommendation_controller import (
    get_unified_recommendations,
    get_food_predictions,
    get_sleep_predictions,
    get_activity_predictions,
    get_alcohol_predictions,
    get_smoking_predictions,
    get_healthy_defaults
)
from middleware.firebase_auth import firebase_auth_required

# Create blueprint
lifestyle_bp = Blueprint('lifestyle', __name__, url_prefix='/api/v1/lifestyle')


# ==================== UNIFIED ENDPOINTS ====================

@lifestyle_bp.route('/recommendations', methods=['GET'])
@firebase_auth_required
def recommendations():
    """
    Get unified recommendations for all lifestyle trackers.
    
    Query Parameters:
    - days: Number of days to analyze (default: 30, max: 90)
    
    Returns comprehensive recommendations based on all available tracker data.
    """
    return get_unified_recommendations()


@lifestyle_bp.route('/defaults', methods=['GET'])
def defaults():
    """
    Get healthy default recommendations.
    
    No authentication required - provides general health guidelines.
    """
    return get_healthy_defaults()


# ==================== TRACKER-SPECIFIC PREDICTIONS ====================

@lifestyle_bp.route('/food/predictions', methods=['GET'])
@firebase_auth_required
def food_predictions():
    """
    Get food-specific timeline predictions.
    
    Query Parameters:
    - days: Number of days to analyze (default: 7)
    """
    return get_food_predictions()


@lifestyle_bp.route('/sleep/predictions', methods=['GET'])
@firebase_auth_required
def sleep_predictions():
    """
    Get sleep-specific timeline predictions.
    """
    return get_sleep_predictions()


@lifestyle_bp.route('/activity/predictions', methods=['GET'])
@firebase_auth_required
def activity_predictions():
    """
    Get activity/step-specific timeline predictions.
    """
    return get_activity_predictions()


@lifestyle_bp.route('/alcohol/predictions', methods=['GET'])
@firebase_auth_required
def alcohol_predictions():
    """
    Get alcohol-specific timeline predictions.
    """
    return get_alcohol_predictions()


@lifestyle_bp.route('/smoking/predictions', methods=['GET'])
@firebase_auth_required
def smoking_predictions():
    """
    Get smoking-specific timeline predictions.
    """
    return get_smoking_predictions()
