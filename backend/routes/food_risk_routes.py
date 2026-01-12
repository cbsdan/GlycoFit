from flask import Blueprint
from controllers.food_risk_assessment_controller import FoodRiskAssessmentController

food_risk_bp = Blueprint('food_risk', __name__)

@food_risk_bp.route('/baseline/questions', methods=['GET'])
def get_baseline_questions():
    """
    GET /api/v1/food-risk/baseline/questions
    
    Get all baseline assessment questions
    
    Response:
    {
        "success": true,
        "message": "Baseline questions retrieved successfully",
        "data": {
            "questions": [
                {
                    "key": "daily_meal_frequency",
                    "question": "How many meals do you typically eat per day?",
                    "type": "number",
                    "options": null
                },
                ...
            ],
            "total_questions": 16
        }
    }
    """
    return FoodRiskAssessmentController.get_baseline_questions()

@food_risk_bp.route('/baseline/submit', methods=['POST'])
def submit_baseline_assessment():
    """
    POST /api/v1/food-risk/baseline/submit
    
    Submit or update baseline assessment responses
    
    Request:
    - Content-Type: application/json
    - Body: {
        "responses": {
            "daily_meal_frequency": 3,
            "skip_breakfast": "Never",
            "late_night_eating": "Rarely (1-2 times/week)",
            ...
        }
      }
    - Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Baseline assessment created successfully",
        "data": {
            "assessment_id": "507f1f77bcf86cd799439011",
            "baseline_risk_score": 45.67
        }
    }
    """
    return FoodRiskAssessmentController.submit_baseline_assessment()

@food_risk_bp.route('/baseline', methods=['GET'])
def get_user_baseline():
    """
    GET /api/v1/food-risk/baseline
    
    Get user's baseline assessment
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Baseline assessment retrieved successfully",
        "data": {
            "id": "507f1f77bcf86cd799439011",
            "responses": {
                "daily_meal_frequency": 3,
                "skip_breakfast": "Never",
                ...
            },
            "baseline_risk_score": 45.67,
            "created_at": "2025-09-02T10:30:00.000Z",
            "updated_at": "2025-09-02T10:30:00.000Z"
        }
    }
    """
    return FoodRiskAssessmentController.get_user_baseline()

@food_risk_bp.route('/assessment', methods=['GET'])
def get_risk_assessment():
    """
    GET /api/v1/food-risk/assessment
    
    Get comprehensive prediabetes risk assessment
    
    Query Parameters:
    - days: Number of days to analyze for daily logs (default: 7, max: 90)
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Risk assessment completed successfully",
        "data": {
            "comprehensive_risk_score": 52.34,
            "risk_category": "Moderate",
            "risk_message": "Your eating habits show moderate risk...",
            "breakdown": {
                "baseline_risk": 45.67,
                "daily_log_risk": 56.78,
                "daily_analysis": {
                    "nutrient_risk": 58.90,
                    "pattern_risk": 52.34,
                    "daily_averages": {
                        "calories": 2100.5,
                        "protein": 75.3,
                        "carbs": 280.5,
                        "fat": 70.2,
                        "added_sugars": 35.6,
                        "fiber": 18.4,
                        "saturated_fat": 22.1,
                        "unsaturated_fat": 48.1,
                        "sodium": 2450.3,
                        "glycemic_load": 125.7
                    },
                    "days_analyzed": 7,
                    "total_meals": 21
                }
            }
        }
    }
    """
    return FoodRiskAssessmentController.get_risk_assessment()

@food_risk_bp.route('/recommendations', methods=['GET'])
def get_personalized_recommendations():
    """
    GET /api/v1/food-risk/recommendations
    
    Get personalized recommendations based on risk assessment
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Recommendations generated successfully",
        "data": {
            "risk_assessment": {
                "comprehensive_risk_score": 52.34,
                "risk_category": "Moderate",
                ...
            },
            "recommendations": [
                {
                    "category": "Added Sugars",
                    "priority": "High",
                    "message": "Your daily added sugar intake (35.6g) exceeds the recommended 25g..."
                },
                ...
            ]
        }
    }
    """
    return FoodRiskAssessmentController.get_personalized_recommendations()

@food_risk_bp.route('/daily-log-analysis', methods=['GET'])
def get_daily_log_analysis():
    """
    GET /api/v1/food-risk/daily-log-analysis
    
    Get analysis of daily food logs
    
    Query Parameters:
    - days: Number of days to analyze (default: 7, max: 90)
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Daily log analysis completed successfully",
        "data": {
            "daily_risk_score": 56.78,
            "analysis": {
                "nutrient_risk": 58.90,
                "pattern_risk": 52.34,
                "daily_averages": {...},
                "days_analyzed": 7,
                "total_meals": 21
            }
        }
    }
    """
    return FoodRiskAssessmentController.get_daily_log_analysis()
