from flask import Blueprint, jsonify
from controllers.nutrient_controller import NutrientController

nutrient_bp = Blueprint('nutrients', __name__)

@nutrient_bp.route('/predict-only', methods=['POST'])
def predict_nutrients_only():
    """
    POST /api/v1/nutrients/predict-only
    
    Predict nutrient values from uploaded food image without saving
    
    Request:
    - Content-Type: multipart/form-data
    - Body: 
      - image file with key 'image' (required)
    - Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Nutrient prediction completed successfully",
        "data": {
            "nutrients": {
                "Calories": 245.67,
                "Protein (g)": 12.34,
                "Carbs (g)": 35.89,
                "Fat (g)": 8.90
            },
            "temp_image_url": "https://res.cloudinary.com/...",
            "temp_image_public_id": "temp_meals/temp_12345",
            "filename": "food_image.jpg",
            "valid_food_types": ["breakfast", "lunch", "dinner", "snacks", "drinks"]
        }
    }
    """
    return NutrientController.predict_nutrients_only()

@nutrient_bp.route('/save-meal', methods=['POST'])
def save_meal():
    """
    POST /api/v1/nutrients/save-meal
    
    Save meal after user has edited the details
    
    Request:
    - Content-Type: application/json
    - Body: {
        "nutrients": {
            "Calories": 245.67,
            "Protein (g)": 12.34,
            "Carbs (g)": 35.89,
            "Fat (g)": 8.90
        },
        "meal_name": "My Breakfast",
        "food_type": "breakfast",
        "notes": "Delicious meal",
        "temp_image_public_id": "temp_meals/temp_12345"
      }
    - Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Meal saved successfully",
        "data": {
            "meal_id": "507f1f77bcf86cd799439011",
            "nutrients": {...},
            "image_url": "https://res.cloudinary.com/...",
            "meal_name": "My Breakfast",
            "notes": "Delicious meal",
            "food_type": "breakfast"
        }
    }
    """
    return NutrientController.save_meal()

@nutrient_bp.route('/model-status', methods=['GET'])
def get_model_status():
    """
    GET /api/v1/nutrients/model-status
    
    Get the status of the ML model
    
    Response:
    {
        "success": true,
        "model_ready": true,
        "message": "Model is ready"
    }
    """
    return NutrientController.get_model_status()

@nutrient_bp.route('/info', methods=['GET'])
def get_nutrient_info():
    """
    GET /api/v1/nutrients/info
    
    Get information about the nutrient prediction service
    
    Response:
    {
        "success": true,
        "message": "Nutrient prediction service information",
        "data": {
            "supported_formats": ["png", "jpg", "jpeg", "gif", "bmp", "webp"],
            "max_file_size": "10MB",
            "nutrients_predicted": ["Calories", "Protein (g)", "Carbs (g)", "Fat (g)"],
            "model_type": "ResNet50-based Nutrient Predictor"
        }
    }
    """
    return jsonify({
        'success': True,
        'message': 'Nutrient prediction service information',
        'data': {
            'supported_formats': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
            'max_file_size': '10MB',
            'nutrients_predicted': ['Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)'],
            'model_type': 'ResNet50-based Nutrient Predictor'
        }
    }), 200

# Meal Management Routes
@nutrient_bp.route('/meals', methods=['GET'])
def get_user_meals():
    """
    GET /api/v1/nutrients/meals
    
    Get user's meal history
    
    Query Parameters:
    - limit: Number of meals to return (default: 50, max: 100)
    - offset: Number of meals to skip (default: 0)
    - start_date: Filter meals from this date (ISO format)
    - end_date: Filter meals until this date (ISO format)
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Meals retrieved successfully",
        "data": {
            "meals": [...],
            "count": 25,
            "limit": 50,
            "offset": 0
        }
    }
    """
    return NutrientController.get_user_meals()

@nutrient_bp.route('/meals/<meal_id>', methods=['GET'])
def get_meal_by_id(meal_id):
    """
    GET /api/v1/nutrients/meals/<meal_id>
    
    Get a specific meal by ID
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Meal retrieved successfully",
        "data": {
            "id": "507f1f77bcf86cd799439011",
            "nutrients": {...},
            "image_url": "https://res.cloudinary.com/...",
            "meal_name": "Breakfast",
            "notes": "Delicious meal",
            "meal_datetime": "2025-09-02T10:30:00.000Z"
        }
    }
    """
    return NutrientController.get_meal_by_id(meal_id)

@nutrient_bp.route('/meals/<meal_id>', methods=['PUT'])
def update_meal(meal_id):
    """
    PUT /api/v1/nutrients/meals/<meal_id>
    
    Update meal details (meal_name and notes only)
    
    Request:
    - Content-Type: application/json
    - Body: {
        "meal_name": "Updated Meal Name",
        "notes": "Updated notes"
      }
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Meal updated successfully"
    }
    """
    return NutrientController.update_meal(meal_id)

@nutrient_bp.route('/meals/<meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    """
    DELETE /api/v1/nutrients/meals/<meal_id>
    
    Delete a meal record
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Meal deleted successfully"
    }
    """
    return NutrientController.delete_meal(meal_id)

@nutrient_bp.route('/nutrition-summary', methods=['GET'])
def get_nutrition_summary():
    """
    GET /api/v1/nutrients/nutrition-summary
    
    Get nutrition summary for the user
    
    Query Parameters:
    - start_date: Filter from this date (ISO format)
    - end_date: Filter until this date (ISO format)
    
    Requires Firebase authentication (Bearer token in Authorization header)
    
    Response:
    {
        "success": true,
        "message": "Nutrition summary retrieved successfully",
        "data": {
            "total_nutrients": {
                "calories": 2456.78,
                "protein": 123.45,
                "carbs": 358.90,
                "fat": 89.01
            },
            "average_nutrients": {
                "calories": 245.68,
                "protein": 12.35,
                "carbs": 35.89,
                "fat": 8.90
            },
            "meal_count": 10
        }
    }
    """
    return NutrientController.get_nutrition_summary()
