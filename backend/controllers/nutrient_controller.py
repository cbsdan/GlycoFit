from flask import request, jsonify
import logging
import tempfile
import os
from services.ml_service import get_ml_service
from services.cloudinary_service import CloudinaryService
from models.user_meal import UserMeal
from middleware.firebase_auth import firebase_auth_required, get_current_user_id

class NutrientController:
    @staticmethod
    def predict_nutrients_only():
        """
        Predict nutrients from uploaded food image (without saving to database)
        
        Expected request:
        - Multipart form data with 'image' file
        
        Returns:
        - JSON response with predicted nutrient values and temporary image URL
        """
        try:
            # Check if image file is present in request
            if 'image' not in request.files:
                return jsonify({
                    'success': False,
                    'error': 'No image file provided'
                }), 400
            
            image_file = request.files['image']
            
            # Check if file is actually selected
            if image_file.filename == '':
                return jsonify({
                    'success': False,
                    'error': 'No image file selected'
                }), 400
            
            # Validate file type
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
            if not image_file.filename.lower().split('.')[-1] in allowed_extensions:
                return jsonify({
                    'success': False,
                    'error': 'Invalid file type. Allowed types: png, jpg, jpeg, gif, bmp, webp'
                }), 400
            
            # Validate file size (max 10MB)
            image_data = image_file.read()
            max_size = 10 * 1024 * 1024  # 10MB
            if len(image_data) > max_size:
                return jsonify({
                    'success': False,
                    'error': 'File too large. Maximum size is 10MB'
                }), 413
            
            # Step 1: Get ML service and make prediction
            try:
                ml_service = get_ml_service()
                if not ml_service.is_model_ready():
                    return jsonify({
                        'success': False,
                        'error': 'ML model not ready'
                    }), 503
                
                # Predict nutrients
                prediction_result = ml_service.predict_nutrients(image_data)
                
                if not prediction_result['success']:
                    logging.error(f"ML prediction failed: {prediction_result.get('error', 'Unknown error')}")
                    return jsonify({
                        'success': False,
                        'error': f"Prediction failed: {prediction_result.get('error', 'Unknown error')}"
                    }), 500
                
                nutrients = prediction_result['nutrients']
                
            except Exception as ml_error:
                logging.error(f"ML service error: {str(ml_error)}")
                return jsonify({
                    'success': False,
                    'error': 'ML service unavailable'
                }), 503
            
            # Step 2: Upload image to Cloudinary (to temp folder for preview)
            image_url = None
            image_public_id = None
            
            try:
                # Create a temporary file for Cloudinary upload
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{image_file.filename.split('.')[-1]}") as temp_file:
                    temp_file.write(image_data)
                    temp_file_path = temp_file.name
                
                # Upload to Cloudinary in temp folder
                upload_result = CloudinaryService.upload_image(
                    file_path=temp_file_path,
                    folder='temp_meals',  # Temporary folder
                    public_id=f"temp_meal_{int(__import__('time').time())}_{__import__('random').randint(1000, 9999)}",
                    transformation=[
                        {'width': 800, 'height': 600, 'crop': 'limit'},
                        {'quality': 'auto', 'fetch_format': 'auto'}
                    ]
                )
                
                # Clean up temporary file
                os.unlink(temp_file_path)
                
                if upload_result['success']:
                    image_url = upload_result['url']
                    image_public_id = upload_result['public_id']
                    logging.info(f"Temp image uploaded to Cloudinary successfully: {image_public_id}")
                else:
                    logging.warning(f"Failed to upload image to Cloudinary: {upload_result.get('error')}")
                    # Continue without image upload - we still have the prediction
                
            except Exception as upload_error:
                logging.error(f"Error uploading image to Cloudinary: {str(upload_error)}")
                # Continue without image upload - we still have the prediction
            
            # Return prediction results for user to edit
            return jsonify({
                'success': True,
                'message': 'Nutrient prediction completed successfully',
                'data': {
                    'nutrients': nutrients,
                    'temp_image_url': image_url,
                    'temp_image_public_id': image_public_id,
                    'filename': image_file.filename,
                    'valid_food_types': UserMeal.VALID_MEAL_TYPES
                }
            }), 200
            
        except Exception as e:
            logging.error(f"Error in nutrient prediction endpoint: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def save_meal():
        """
        Save meal after user has edited the details
        
        Expected request:
        - JSON body with:
          - nutrients: Dict with predicted nutrients
          - meal_name: User-provided meal name
          - food_type: User-selected food type
          - notes: Optional notes
          - temp_image_public_id: Temporary image ID from prediction step
        
        Returns:
        - JSON response with saved meal details
        """
        try:
            user_id = get_current_user_id()
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400
            
            # Required fields
            nutrients = data.get('nutrients')
            meal_name = data.get('meal_name')
            food_type = data.get('food_type')
            
            if not nutrients:
                return jsonify({
                    'success': False,
                    'error': 'Nutrients data is required'
                }), 400
            
            if not food_type:
                return jsonify({
                    'success': False,
                    'error': 'Food type is required'
                }), 400
            
            # Optional fields
            notes = data.get('notes', '')
            temp_image_public_id = data.get('temp_image_public_id')
            
            # Step 1: Move image from temp folder to permanent folder (if exists)
            image_url = None
            image_public_id = None
            
            if temp_image_public_id:
                try:
                    # Get the temp image URL first
                    temp_image_url = f"https://res.cloudinary.com/{os.getenv('CLOUDINARY_CLOUD_NAME')}/image/upload/{temp_image_public_id}"
                    
                    # Upload to permanent location
                    upload_result = CloudinaryService.upload_image(
                        file_path=temp_image_url,  # Can upload from URL
                        folder='user_meals',
                        public_id=f"meal_{user_id}_{int(__import__('time').time())}",
                        transformation=[
                            {'width': 800, 'height': 600, 'crop': 'limit'},
                            {'quality': 'auto', 'fetch_format': 'auto'}
                        ]
                    )
                    
                    if upload_result['success']:
                        image_url = upload_result['url']
                        image_public_id = upload_result['public_id']
                        logging.info(f"Image moved to permanent location: {image_public_id}")
                        
                        # Delete temp image
                        try:
                            CloudinaryService.delete_image(temp_image_public_id)
                            logging.info(f"Temp image deleted: {temp_image_public_id}")
                        except Exception as delete_error:
                            logging.warning(f"Failed to delete temp image: {str(delete_error)}")
                    else:
                        logging.warning(f"Failed to move image to permanent location: {upload_result.get('error')}")
                        
                except Exception as move_error:
                    logging.error(f"Error moving image to permanent location: {str(move_error)}")
            
            # Step 2: Save meal record to database
            try:
                meal_result = UserMeal.create_meal(
                    user_id=user_id,
                    nutrients=nutrients,
                    image_url=image_url,
                    image_public_id=image_public_id,
                    meal_name=meal_name,
                    notes=notes,
                    food_type=food_type
                )
                
                if meal_result['success']:
                    logging.info(f"Meal record saved successfully for user {user_id}: {meal_result['meal_id']}")
                    
                    return jsonify({
                        'success': True,
                        'message': 'Meal saved successfully',
                        'data': {
                            'meal_id': meal_result['meal_id'],
                            'nutrients': nutrients,
                            'image_url': image_url,
                            'meal_name': meal_name,
                            'notes': notes,
                            'food_type': food_type
                        }
                    }), 201
                else:
                    logging.error(f"Failed to save meal record: {meal_result.get('error')}")
                    return jsonify({
                        'success': False,
                        'error': f"Failed to save meal: {meal_result.get('error')}"
                    }), 500
                    
            except Exception as db_error:
                logging.error(f"Database error when saving meal: {str(db_error)}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to save meal to database'
                }), 500
            
        except Exception as e:
            logging.error(f"Error in save meal endpoint: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500
    
    @staticmethod
    def get_model_status():
        """
        Get the status of the ML model
        
        Returns:
        - JSON response with model status
        """
        try:
            ml_service = get_ml_service()
            is_ready = ml_service.is_model_ready()
            
            return jsonify({
                'success': True,
                'model_ready': is_ready,
                'message': 'Model is ready' if is_ready else 'Model not ready'
            }), 200
            
        except Exception as e:
            logging.error(f"Error checking model status: {str(e)}")
            return jsonify({
                'success': False,
                'model_ready': False,
                'error': str(e)
            }), 500

    @staticmethod
    @firebase_auth_required
    def get_user_meals():
        """
        Get user's meal history
        
        Query parameters:
        - limit: Number of meals to return (default: 50)
        - offset: Number of meals to skip (default: 0)
        - start_date: Filter meals from this date (ISO format)
        - end_date: Filter meals until this date (ISO format)
        
        Returns:
        - JSON response with user's meals
        """
        try:
            user_id = get_current_user_id()
            
            # Get query parameters
            limit = int(request.args.get('limit', 50))
            offset = int(request.args.get('offset', 0))
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            # Validate limits
            limit = min(limit, 100)  # Max 100 meals per request
            
            result = UserMeal.get_user_meals(
                user_id=user_id,
                limit=limit,
                offset=offset,
                start_date=start_date,
                end_date=end_date
            )
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': 'Meals retrieved successfully',
                    'data': {
                        'meals': result['meals'],
                        'count': result['count'],
                        'limit': limit,
                        'offset': offset
                    }
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 500
                
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': 'Invalid query parameters'
            }), 400
        except Exception as e:
            logging.error(f"Error getting user meals: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def get_meal_by_id(meal_id):
        """
        Get a specific meal by ID
        
        Args:
        - meal_id: The ID of the meal to retrieve
        
        Returns:
        - JSON response with meal details
        """
        try:
            user_id = get_current_user_id()
            
            result = UserMeal.get_meal_by_id(meal_id, user_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': 'Meal retrieved successfully',
                    'data': result['meal']
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 404
                
        except Exception as e:
            logging.error(f"Error getting meal {meal_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def update_meal(meal_id):
        """
        Update meal details (meal_name, notes, and food_type)
        
        Expected request:
        - JSON body with optional 'meal_name', 'notes', and 'food_type' fields
        
        Returns:
        - JSON response with update status
        """
        try:
            user_id = get_current_user_id()
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400
            
            meal_name = data.get('meal_name')
            notes = data.get('notes')
            food_type = data.get('food_type')
            
            # At least one field should be provided
            if meal_name is None and notes is None and food_type is None:
                return jsonify({
                    'success': False,
                    'error': 'At least one field (meal_name, notes, or food_type) must be provided'
                }), 400
            
            result = UserMeal.update_meal(
                meal_id=meal_id,
                user_id=user_id,
                meal_name=meal_name,
                notes=notes,
                food_type=food_type
            )
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': result['message']
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 404
                
        except Exception as e:
            logging.error(f"Error updating meal {meal_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def delete_meal(meal_id):
        """
        Delete a meal record
        
        Args:
        - meal_id: The ID of the meal to delete
        
        Returns:
        - JSON response with deletion status
        """
        try:
            user_id = get_current_user_id()
            
            result = UserMeal.delete_meal(meal_id, user_id)
            
            if result['success']:
                # If there's an image, try to delete it from Cloudinary
                if result.get('image_public_id'):
                    try:
                        CloudinaryService.delete_image(result['image_public_id'])
                        logging.info(f"Image deleted from Cloudinary: {result['image_public_id']}")
                    except Exception as img_error:
                        logging.warning(f"Failed to delete image from Cloudinary: {str(img_error)}")
                        # Don't fail the whole operation if image deletion fails
                
                return jsonify({
                    'success': True,
                    'message': result['message']
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 404
                
        except Exception as e:
            logging.error(f"Error deleting meal {meal_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def get_nutrition_summary():
        """
        Get nutrition summary for the user
        
        Query parameters:
        - start_date: Filter from this date (ISO format)
        - end_date: Filter until this date (ISO format)
        
        Returns:
        - JSON response with nutrition summary
        """
        try:
            user_id = get_current_user_id()
            
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            result = UserMeal.get_nutrition_summary(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date
            )
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': 'Nutrition summary retrieved successfully',
                    'data': result['summary']
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 500
                
        except Exception as e:
            logging.error(f"Error getting nutrition summary: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def get_meals_by_food_type(food_type):
        """
        Get user's meals filtered by food type
        
        Query parameters:
        - limit: Number of meals to return (default: 50)
        - offset: Number of meals to skip (default: 0)
        - start_date: Filter meals from this date (ISO format)
        - end_date: Filter meals until this date (ISO format)
        
        Returns:
        - JSON response with user's meals of specific food type
        """
        try:
            user_id = get_current_user_id()
            
            # Get query parameters
            limit = int(request.args.get('limit', 50))
            offset = int(request.args.get('offset', 0))
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            # Validate limits
            limit = min(limit, 100)  # Max 100 meals per request
            
            result = UserMeal.get_meals_by_food_type(
                user_id=user_id,
                food_type=food_type,
                limit=limit,
                offset=offset,
                start_date=start_date,
                end_date=end_date
            )
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': f'Meals of type "{food_type}" retrieved successfully',
                    'data': {
                        'meals': result['meals'],
                        'count': result['count'],
                        'food_type': result['food_type'],
                        'limit': limit,
                        'offset': offset
                    }
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 400
                
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': 'Invalid query parameters'
            }), 400
        except Exception as e:
            logging.error(f"Error getting meals by food type: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def get_food_type_summary():
        """
        Get nutrition summary grouped by food type
        
        Query parameters:
        - start_date: Filter from this date (ISO format)
        - end_date: Filter until this date (ISO format)
        
        Returns:
        - JSON response with nutrition summary by food type
        """
        try:
            user_id = get_current_user_id()
            
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            result = UserMeal.get_food_type_summary(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date
            )
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': 'Food type summary retrieved successfully',
                    'data': result['summary_by_food_type']
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 500
                
        except Exception as e:
            logging.error(f"Error getting food type summary: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    def get_valid_food_types():
        """
        Get list of valid food types
        
        Returns:
        - JSON response with valid food types
        """
        return jsonify({
            'success': True,
            'message': 'Valid food types retrieved successfully',
            'data': {
                'valid_food_types': UserMeal.VALID_MEAL_TYPES,
                'default_type': 'other'
            }
        }), 200
