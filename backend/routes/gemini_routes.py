from flask import Blueprint, jsonify
from controllers.gemini_controller import GeminiController

gemini_bp = Blueprint('gemini', __name__)

@gemini_bp.route('/analyze', methods=['POST'])
def analyze_food():
    """
    POST /api/v1/gemini/analyze
    
    Analyze food image using Gemini AI without saving to database
    
    Request:
    - Content-Type: multipart/form-data
    - Body: 
      - image file with key 'image' (required)
    - Requires Firebase authentication (Bearer token in Authorization header)
    
    Response for successful food detection:
    {
        "success": true,
        "message": "Food analysis completed successfully",
        "data": {
            "meal_name": "Grilled Chicken Salad",
            "nutrients": {
                "Calories": 350.5,
                "Carbs (g)": 25.0,
                "Added Sugars (g)": 3.2,
                "Fiber (g)": 5.5,
                "Protein (g)": 35.0,
                "Fat (g)": 12.5
            },
            "confidence": "high",
            "temp_image_url": "https://res.cloudinary.com/...",
            "temp_image_public_id": "temp_meals/temp_12345",
            "filename": "food.jpg",
            "valid_food_types": ["breakfast", "lunch", "dinner", "snacks", "drinks", "dessert", "unlabeled", "other"]
        }
    }
    
    Response when food is not detected:
    {
        "success": false,
        "error": "Cannot detect food in the image",
        "message": "Please upload a clear image of food"
    }
    """
    return GeminiController.analyze_food_with_gemini()

@gemini_bp.route('/save-meal', methods=['POST'])
def save_gemini_meal():
    """
    POST /api/v1/gemini/save-meal
    
    Save meal analyzed by Gemini after user has edited the details
    
    Request:
    - Content-Type: application/json
    - Body: {
        "meal_name": "Grilled Chicken Salad",
        "nutrients": {
            "Calories": 350.5,
            "Carbs (g)": 25.0,
            "Added Sugars (g)": 3.2,
            "Fiber (g)": 5.5,
            "Protein (g)": 35.0,
            "Fat (g)": 12.5
        },
        "food_type": "lunch",
        "notes": "Healthy and delicious",
        "temp_image_public_id": "temp_meals/temp_12345"
      }
    - Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Meal saved successfully",
        "data": {
            "meal_id": "507f1f77bcf86cd799439011",
            "meal_name": "Grilled Chicken Salad",
            "nutrients": {...},
            "image_url": "https://res.cloudinary.com/...",
            "notes": "Healthy and delicious",
            "food_type": "lunch"
        }
    }
    """
    return GeminiController.save_gemini_meal()

@gemini_bp.route('/status', methods=['GET'])
def get_gemini_status():
    """
    GET /api/v1/gemini/status
    
    Get the status of the Gemini AI service
    
    Response:
    {
        "success": true,
        "gemini_ready": true,
        "message": "Gemini AI is ready"
    }
    """
    return GeminiController.get_gemini_status()

@gemini_bp.route('/info', methods=['GET'])
def get_gemini_info():
    """
    GET /api/v1/gemini/info
    
    Get information about the Gemini AI food analysis service
    
    Response:
    {
        "success": true,
        "message": "Gemini AI food analysis service information",
        "data": {
            "supported_formats": ["png", "jpg", "jpeg", "gif", "bmp", "webp"],
            "max_file_size": "10MB",
            "nutrients_analyzed": [
                "Calories",
                "Carbs (g)",
                "Added Sugars (g)",
                "Fiber (g)",
                "Protein (g)",
                "Fat (g)"
            ],
            "features": [
                "Automatic meal name detection",
                "Detailed nutritional analysis",
                "Confidence level reporting",
                "Food detection validation"
            ],
            "model": "Google Gemini 1.5 Flash"
        }
    }
    """
    return jsonify({
        'success': True,
        'message': 'Gemini AI food analysis service information',
        'data': {
            'supported_formats': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
            'max_file_size': '10MB',
            'nutrients_analyzed': [
                'Calories',
                'Carbs (g)',
                'Added Sugars (g)',
                'Fiber (g)',
                'Protein (g)',
                'Fat (g)'
            ],
            'features': [
                'Automatic meal name detection',
                'Detailed nutritional analysis',
                'Confidence level reporting',
                'Food detection validation'
            ],
            'model': 'Google Gemini 1.5 Flash'
        }
    }), 200
