"""
Alcohol Intake Routes

REST API endpoints for tracking alcohol consumption and diabetes risk assessment.
"""

from flask import Blueprint
from controllers.alcohol_intake_controller import (
    create_or_update_alcohol_intake,
    get_alcohol_intake,
    delete_alcohol_intake,
    get_alcohol_intake_history,
    get_risk_assessment,
    get_statistics
)
from middleware.firebase_auth import firebase_auth_required

# Create Blueprint
alcohol_intake_bp = Blueprint('alcohol_intake', __name__)


@alcohol_intake_bp.route('/', methods=['POST', 'PUT'])
@firebase_auth_required
def handle_create_or_update():
    """
    Create or update alcohol intake data.
    
    ---
    POST/PUT /api/v1/alcohol-intake/
    
    Headers:
        Authorization: Bearer <firebase_token>
    
    Request Body:
        {
            "average_drinks_per_day": 2.5,      // Optional, float, 0-20
            "drinking_days_per_week": 3,        // Optional, int, 0-7
            "binge_frequency_per_month": 1      // Optional, int, 0-31
        }
    
    Response (200):
        {
            "success": true,
            "message": "Alcohol intake data saved successfully",
            "data": {
                "id": "507f1f77bcf86cd799439011",
                "user_id": "user123",
                "average_drinks_per_day": 2.5,
                "drinking_days_per_week": 3,
                "drinks_per_week": 7.5,
                "binge_frequency_per_month": 1,
                "alcohol_risk_category": "moderate",
                "diabetes_risk_score": 0,
                "diabetes_risk_multiplier": 1.0,
                "risk_explanation": "Moderate drinking - neutral to slightly elevated risk",
                "created_at": "2026-01-04T10:30:00Z",
                "last_updated": "2026-01-04T10:30:00Z",
                "history": []
            }
        }
    """
    return create_or_update_alcohol_intake()


@alcohol_intake_bp.route('/', methods=['GET'])
@firebase_auth_required
def handle_get():
    """
    Get current alcohol intake data for authenticated user.
    
    ---
    GET /api/v1/alcohol-intake/
    
    Headers:
        Authorization: Bearer <firebase_token>
    
    Response (200):
        {
            "success": true,
            "message": "Alcohol intake data retrieved successfully",
            "data": { ... }
        }
    """
    return get_alcohol_intake()


@alcohol_intake_bp.route('/', methods=['DELETE'])
@firebase_auth_required
def handle_delete():
    """
    Delete alcohol intake data for authenticated user.
    
    ---
    DELETE /api/v1/alcohol-intake/
    
    Headers:
        Authorization: Bearer <firebase_token>
    
    Response (200):
        {
            "success": true,
            "message": "Alcohol intake data deleted successfully"
        }
    """
    return delete_alcohol_intake()


@alcohol_intake_bp.route('/history', methods=['GET'])
@firebase_auth_required
def handle_get_history():
    """
    Get historical alcohol intake data.
    
    ---
    GET /api/v1/alcohol-intake/history
    
    Headers:
        Authorization: Bearer <firebase_token>
    
    Response (200):
        {
            "success": true,
            "message": "Alcohol intake history retrieved successfully",
            "data": {
                "current": {
                    "average_drinks_per_day": 2.5,
                    "drinking_days_per_week": 3,
                    "drinks_per_week": 7.5,
                    "binge_frequency_per_month": 1,
                    "alcohol_risk_category": "moderate",
                    "diabetes_risk_score": 0,
                    "last_updated": "2026-01-04T10:30:00Z"
                },
                "history": [
                    {
                        "average_drinks_per_day": 3.0,
                        "drinking_days_per_week": 4,
                        "drinks_per_week": 12.0,
                        "binge_frequency_per_month": 2,
                        "alcohol_risk_category": "moderate",
                        "diabetes_risk_score": 0,
                        "timestamp": "2025-12-04T10:30:00Z"
                    }
                ]
            }
        }
    """
    return get_alcohol_intake_history()


@alcohol_intake_bp.route('/risk-assessment', methods=['GET'])
@firebase_auth_required
def handle_get_risk_assessment():
    """
    Get comprehensive risk assessment based on alcohol intake.
    
    ---
    GET /api/v1/alcohol-intake/risk-assessment
    
    Headers:
        Authorization: Bearer <firebase_token>
    
    Response (200):
        {
            "success": true,
            "message": "Risk assessment generated successfully",
            "data": {
                "has_data": true,
                "current_consumption": {
                    "drinks_per_week": 7.5,
                    "average_drinks_per_day": 2.5,
                    "drinking_days_per_week": 3,
                    "binge_frequency_per_month": 1
                },
                "risk_level": "moderate",
                "diabetes_risk_score": 0,
                "diabetes_risk_multiplier": 1.0,
                "risk_explanation": "Moderate drinking - neutral to slightly elevated risk",
                "recommendations": [
                    "Your alcohol intake is at moderate risk level.",
                    "Consider reducing to ≤7 drinks per week to lower diabetes risk.",
                    "Avoid drinking on consecutive days to give your body recovery time.",
                    "Monitor your blood glucose levels regularly.",
                    "Always eat food when drinking to slow alcohol absorption.",
                    "Stay hydrated by drinking water between alcoholic beverages."
                ],
                "trend": {
                    "status": "improving",
                    "message": "Great! You've reduced intake by 4.5 drinks/week (37.5%)",
                    "change_drinks_per_week": -4.5,
                    "percent_change": -37.5,
                    "records_analyzed": 2
                },
                "last_updated": "2026-01-04T10:30:00Z"
            }
        }
    """
    return get_risk_assessment()


@alcohol_intake_bp.route('/statistics', methods=['GET'])
@firebase_auth_required  # Add admin role check in production
def handle_get_statistics():
    """
    Get aggregate statistics on alcohol intake patterns.
    
    Note: This endpoint should be restricted to admin users in production.
    
    ---
    GET /api/v1/alcohol-intake/statistics?start_date=2025-01-01&end_date=2026-01-01
    
    Headers:
        Authorization: Bearer <firebase_token>
    
    Query Parameters:
        start_date (optional): ISO format date (YYYY-MM-DD)
        end_date (optional): ISO format date (YYYY-MM-DD)
    
    Response (200):
        {
            "success": true,
            "message": "Statistics retrieved successfully",
            "data": {
                "total_users": 150,
                "by_risk_category": {
                    "none": {
                        "count": 45,
                        "avg_drinks_per_week": 0.0,
                        "avg_binge_frequency": 0.0
                    },
                    "light": {
                        "count": 60,
                        "avg_drinks_per_week": 4.2,
                        "avg_binge_frequency": 0.1
                    },
                    "moderate": {
                        "count": 30,
                        "avg_drinks_per_week": 10.5,
                        "avg_binge_frequency": 0.8
                    },
                    "heavy": {
                        "count": 10,
                        "avg_drinks_per_week": 18.3,
                        "avg_binge_frequency": 1.2
                    },
                    "binge": {
                        "count": 5,
                        "avg_drinks_per_week": 15.0,
                        "avg_binge_frequency": 4.5
                    }
                },
                "overall_averages": {
                    "drinks_per_week": 6.8,
                    "binge_frequency": 0.6
                }
            }
        }
    """
    return get_statistics()
