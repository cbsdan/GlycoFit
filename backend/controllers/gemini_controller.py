from flask import request, jsonify
import logging
import os
import tempfile
import time
from datetime import datetime
from services.gemini_service import get_gemini_service, GeminiQuotaExceededError
from services.cloudinary_service import CloudinaryService
from models.user_meal import UserMeal
from middleware.firebase_auth import firebase_auth_required, get_current_user_id

class GeminiController:
    @staticmethod
    # @firebase_auth_required
    def analyze_food_with_gemini():
        """
        Analyze food image using Gemini AI (without saving to database)
        
        Expected request:
        - Multipart form data with 'image' file
        - Optional 'note' field for user's food description
        
        Returns:
        - JSON response with meal name and nutrient values
        """
        try:
            # Check if image file is present in request
            if 'image' not in request.files:
                logging.warning("No image file in request")
                return jsonify({
                    'success': False,
                    'error': 'No image file provided'
                }), 400
            
            image_file = request.files['image']
            
            # Get optional note from form data
            note = request.form.get('note', '').strip()
            if note:
                logging.info(f"User provided food description: {note}")
            
            # Check if file is actually selected
            if image_file.filename == '':
                logging.warning("Empty filename in request")
                return jsonify({
                    'success': False,
                    'error': 'No file selected'
                }), 400
            
            # Validate file type
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
            if not image_file.filename.lower().split('.')[-1] in allowed_extensions:
                logging.warning(f"Invalid file type: {image_file.filename}")
                return jsonify({
                    'success': False,
                    'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, bmp, webp'
                }), 400
            
            # Validate file size (max 10MB)
            image_data = image_file.read()
            max_size = 10 * 1024 * 1024  # 10MB
            if len(image_data) > max_size:
                logging.warning(f"File too large: {len(image_data)} bytes")
                return jsonify({
                    'success': False,
                    'error': 'File too large. Maximum size is 10MB'
                }), 400
            
            # Analyze with Gemini AI
            try:
                gemini_service = get_gemini_service()
                
                if not gemini_service or not gemini_service.is_ready():
                    logging.error("Gemini service not available")
                    return jsonify({
                        'success': False,
                        'error': 'Gemini AI service is not available'
                    }), 503
                
                logging.info("Analyzing food image with Gemini AI")
                analysis_result = gemini_service.analyze_food_image(image_data, note if note else None)
                
                if not analysis_result.get('success'):
                    # Food not detected
                    logging.warning("Gemini could not detect food in image")
                    return jsonify(analysis_result), 200
                
                # Upload image to Cloudinary (temp folder)
                image_url = None
                image_public_id = None
                
                try:
                    # Create temporary file for upload
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{image_file.filename.split('.')[-1]}") as temp_file:
                        # Reset file pointer and write to temp file
                        image_file.seek(0)
                        temp_file.write(image_file.read())
                        temp_file_path = temp_file.name
                    
                    logging.info("Uploading image to Cloudinary (temp folder)")
                    upload_result = CloudinaryService.upload_image(
                        file_path=temp_file_path,
                        folder='temp_meals',
                        public_id=f"temp_meal_{int(time.time())}_{os.urandom(4).hex()}"
                    )
                    
                    # Clean up temp file
                    try:
                        os.unlink(temp_file_path)
                    except:
                        pass
                    
                    if upload_result.get('success'):
                        image_url = upload_result.get('secure_url')
                        image_public_id = upload_result.get('public_id')
                        logging.info(f"Image uploaded successfully: {image_public_id}")
                    else:
                        logging.error(f"Cloudinary upload failed: {upload_result.get('error')}")
                    
                except Exception as upload_error:
                    logging.error(f"Failed to upload image to Cloudinary: {str(upload_error)}")
                    # Continue without image URL
                
                # Return analysis results with image info
                response_data = {
                    'success': True,
                    'message': 'Food analysis completed successfully',
                    'data': {
                        'meal_name': analysis_result.get('meal_name'),
                        'nutrients': analysis_result.get('nutrients'),
                        'serving_size': analysis_result.get('serving_size', ''),
                        'confidence_percentage': analysis_result.get('confidence_percentage', 50),
                        'confidence_explanation': analysis_result.get('confidence_explanation', ''),
                        'health_assessment': analysis_result.get('health_assessment', ''),
                        'recipes': analysis_result.get('recipes', []),
                        'ingredient_nutrients': analysis_result.get('ingredient_nutrients', []),
                        'temp_image_url': image_url,
                        'temp_image_public_id': image_public_id,
                        'filename': image_file.filename,
                        'valid_food_types': UserMeal.VALID_MEAL_TYPES,
                    }
                }
                
                logging.info(f"Food analysis completed successfully (Confidence: {analysis_result.get('confidence_percentage', 50)}%)")
                return jsonify(response_data), 200
                
            except GeminiQuotaExceededError as quota_error:
                logging.warning(f"Gemini quota exceeded: {str(quota_error)}")
                return jsonify({
                    'success': False,
                    'error': 'Daily analysis limit reached. Please try again tomorrow.',
                    'code': 'QUOTA_EXCEEDED'
                }), 429
            except Exception as gemini_error:
                logging.error(f"Gemini analysis error: {str(gemini_error)}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to analyze food image',
                    'details': str(gemini_error)
                }), 500
            
        except Exception as e:
            logging.error(f"Error in Gemini food analysis endpoint: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error',
                'details': str(e)
            }), 500

    @staticmethod
    @firebase_auth_required
    def save_gemini_meal():
        """
        Save meal analyzed by Gemini after user has edited the details
        
        Expected request:
        - JSON body with:
          - nutrients: Dict with nutrient values
          - meal_name: Meal name from Gemini or user-edited
          - food_type: User-selected food type
          - notes: Optional notes
          - temp_image_public_id: Temporary image ID from analysis step
        
        Returns:
        - JSON response with saved meal details
        """
        try:
            user_id = get_current_user_id()
            data = request.get_json()
            
            if not data:
                logging.warning("No JSON data in request")
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400
            
            # Required fields
            nutrients = data.get('nutrients')
            meal_name = data.get('meal_name')
            food_type = data.get('food_type')
            
            if not nutrients:
                logging.warning("Missing nutrients in request")
                return jsonify({
                    'success': False,
                    'error': 'Nutrients are required'
                }), 400
            
            if not food_type:
                logging.warning("Missing food_type in request")
                return jsonify({
                    'success': False,
                    'error': 'Food type is required'
                }), 400
            
            # Optional fields
            notes = data.get('notes', '')
            temp_image_public_id = data.get('temp_image_public_id')
            serving_size = data.get('serving_size')
            confidence_rate = data.get('confidence_rate')
            confidence_explanation = data.get('confidence_explanation', '')
            health_assessment = data.get('health_assessment', '')
            recipes = data.get('recipes', [])
            ingredient_nutrients = data.get('ingredient_nutrients', [])
            ingredient_proportions = data.get('ingredient_proportions', {})
            
            logging.info(f"Saving Gemini meal for user {user_id} - temp_image_public_id: {temp_image_public_id}")
            
            # Move image from temp folder to permanent folder (if exists)
            image_url = None
            image_public_id = None
            
            if temp_image_public_id:
                try:
                    # Generate new public_id for permanent storage
                    new_public_id = f"user_meals/meal_{user_id}_{int(time.time())}"
                    
                    logging.info(f"Moving image from {temp_image_public_id} to {new_public_id}")
                    
                    # Use CloudinaryService rename method
                    rename_result = CloudinaryService.rename_image(
                        from_public_id=temp_image_public_id,
                        to_public_id=new_public_id
                    )
                    
                    if rename_result.get('success'):
                        image_url = rename_result.get('url')
                        image_public_id = rename_result.get('public_id')
                        logging.info(f"Image moved to permanent storage: {image_public_id}")
                    else:
                        logging.error(f"Failed to rename image: {rename_result.get('error')}")
                        # Try to get temp image info as fallback
                        try:
                            temp_info = CloudinaryService.get_image_info(temp_image_public_id)
                            if temp_info.get('success'):
                                image_url = temp_info.get('url')
                                image_public_id = temp_image_public_id
                                logging.info(f"Using temp image as fallback: {image_public_id}")
                        except Exception as fallback_error:
                            logging.error(f"Fallback failed: {str(fallback_error)}")
                    
                except Exception as move_error:
                    logging.error(f"Failed to move image to permanent folder: {str(move_error)}")
                    # Try to use temp image as fallback
                    try:
                        temp_info = CloudinaryService.get_image_info(temp_image_public_id)
                        if temp_info.get('success'):
                            image_url = temp_info.get('url')
                            image_public_id = temp_image_public_id
                            logging.info(f"Using temp image due to move error: {image_public_id}")
                    except Exception as fallback_error:
                        logging.error(f"Could not retrieve temp image: {str(fallback_error)}")
            
            # Save meal record to database
            try:
                result = UserMeal.create_meal(
                    user_id=user_id,
                    nutrients=nutrients,
                    image_url=image_url,
                    image_public_id=image_public_id,
                    meal_name=meal_name,
                    notes=notes,
                    food_type=food_type,
                    serving_size=serving_size,
                    confidence_rate=confidence_rate,
                    confidence_explanation=confidence_explanation,
                    health_assessment=health_assessment,
                    recipes=recipes,
                    ingredient_nutrients=ingredient_nutrients,
                    ingredient_proportions=ingredient_proportions
                )
                
                if result['success']:
                    logging.info(f"Gemini meal saved successfully: {result['meal_id']}")
                    return jsonify({
                        'success': True,
                        'message': 'Meal saved successfully',
                        'data': {
                            'meal_id': result['meal_id'],
                            'nutrients': nutrients,
                            'image_url': image_url,
                            'meal_name': meal_name,
                            'notes': notes,
                            'food_type': food_type,
                            'serving_size': serving_size,
                            'confidence_rate': confidence_rate,
                            'recipes': recipes
                        }
                    }), 201
                else:
                    logging.error(f"Failed to save meal: {result.get('error')}")
                    return jsonify({
                        'success': False,
                        'error': 'Failed to save meal',
                        'details': result.get('error')
                    }), 500
                    
            except Exception as db_error:
                logging.error(f"Database error while saving meal: {str(db_error)}")
                return jsonify({
                    'success': False,
                    'error': 'Database error',
                    'details': str(db_error)
                }), 500
            
        except Exception as e:
            logging.error(f"Error in save Gemini meal endpoint: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error',
                'details': str(e)
            }), 500
    
    @staticmethod
    def get_gemini_status():
        """
        Get the status of the Gemini AI service
        
        Returns:
        - JSON response with service status
        """
        try:
            gemini_service = get_gemini_service()
            is_ready = gemini_service and gemini_service.is_ready()

            usage_today = {}
            try:
                if gemini_service and is_ready:
                    usage_today = gemini_service.get_usage_status()
            except Exception:
                pass

            return jsonify({
                'success': True,
                'gemini_ready': is_ready,
                'message': 'Gemini AI is ready' if is_ready else 'Gemini AI is not available',
                'model': 'gemini-2.5-flash / gemini-2.5-flash-lite',
                'usage': usage_today
            }), 200
            
        except Exception as e:
            logging.error(f"Error checking Gemini status: {str(e)}")
            return jsonify({
                'success': False,
                'gemini_ready': False,
                'error': str(e)
            }), 500

    @staticmethod
    @firebase_auth_required
    def predict_nutrients_from_text():
        """
        Predict nutrients from text description of food
        
        Expected request:
        - JSON body with:
          - food_description: Text description of the food/meal
          - meal_datetime: Optional datetime when meal was eaten (ISO format)
        
        Returns:
        - JSON response with predicted nutrient values (same as image prediction but without recipes/bounding boxes)
        """
        try:
            user_id = get_current_user_id()
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400
            
            food_description = data.get('food_description', '').strip()
            meal_datetime = data.get('meal_datetime')
            
            if not food_description:
                return jsonify({
                    'success': False,
                    'error': 'Food description is required'
                }), 400
            
            # Analyze with Gemini AI
            try:
                gemini_service = get_gemini_service()
                
                if not gemini_service or not gemini_service.is_ready():
                    logging.error("Gemini service not available")
                    return jsonify({
                        'success': False,
                        'error': 'Gemini AI service is not available'
                    }), 503
                
                logging.info(f"Analyzing food from text: {food_description}")
                analysis_result = gemini_service.analyze_food_from_text(food_description)
                
                if not analysis_result.get('success'):
                    # Food not detected
                    logging.warning("Gemini could not identify food from description")
                    return jsonify(analysis_result), 200
                
                # Extract data from Gemini response
                meal_name = analysis_result.get('meal_name', food_description)
                nutrients = analysis_result.get('nutrients', {})
                serving_size = analysis_result.get('serving_size', 'Standard serving')
                confidence_rate = analysis_result.get('confidence_percentage', 50)
                confidence_explanation = analysis_result.get('confidence_explanation', '')
                health_assessment = analysis_result.get('health_assessment', '')
                ingredient_nutrients = analysis_result.get('ingredient_nutrients', [])
                
                # Return prediction results (same format as image prediction but without recipes/boxes)
                return jsonify({
                    'success': True,
                    'message': 'Nutrient prediction from text completed successfully',
                    'data': {
                        'meal_name': meal_name,
                        'nutrients': nutrients,
                        'serving_size': serving_size,
                        'confidence_rate': confidence_rate,
                        'confidence_explanation': confidence_explanation,
                        'health_assessment': health_assessment,
                        'ingredient_nutrients': ingredient_nutrients,
                        'meal_datetime': meal_datetime,
                        'valid_food_types': UserMeal.VALID_MEAL_TYPES,
                        'input_method': 'text'
                    }
                }), 200
                
            except GeminiQuotaExceededError as quota_error:
                logging.warning(f"Gemini quota exceeded (text): {str(quota_error)}")
                return jsonify({
                    'success': False,
                    'error': 'Daily analysis limit reached. Please try again tomorrow.',
                    'code': 'QUOTA_EXCEEDED'
                }), 429
            except Exception as gemini_error:
                logging.error(f"Gemini service error: {str(gemini_error)}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to analyze food description'
                }), 500
            
        except Exception as e:
            logging.error(f"Error in text prediction endpoint: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @staticmethod
    @firebase_auth_required
    def save_meal_from_text():
        """
        Save meal from text-based prediction
        
        Expected request:
        - JSON body with:
          - nutrients: Dict with predicted nutrients
          - meal_name: Predicted or user-edited meal name
          - food_type: User-selected food type
          - notes: Optional notes
          - serving_size: Predicted serving size
          - confidence_rate: Prediction confidence
          - ingredient_nutrients: List of ingredient-level nutrients
          - ingredient_proportions: Optional user-adjusted proportions
          - meal_datetime: When the meal was eaten
        
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
            serving_size = data.get('serving_size')
            confidence_rate = data.get('confidence_rate')
            confidence_explanation = data.get('confidence_explanation', '')
            health_assessment = data.get('health_assessment', '')
            meal_datetime = data.get('meal_datetime')
            ingredient_nutrients = data.get('ingredient_nutrients', [])
            ingredient_proportions = data.get('ingredient_proportions', {})
            
            logging.info(f"Saving text-based meal for user {user_id}")
            
            # Save meal record to database (no image for text-based entries)
            try:
                meal_result = UserMeal.create_meal(
                    user_id=user_id,
                    nutrients=nutrients,
                    image_url=None,  # No image for text-based entry
                    image_public_id=None,
                    meal_name=meal_name,
                    notes=notes,
                    food_type=food_type,
                    serving_size=serving_size,
                    confidence_rate=confidence_rate,
                    confidence_explanation=confidence_explanation,
                    health_assessment=health_assessment,
                    recipes=None,  # No bounding boxes for text-based entry
                    ingredient_nutrients=ingredient_nutrients,
                    ingredient_proportions=ingredient_proportions,
                    meal_datetime=meal_datetime
                )
                
                if meal_result['success']:
                    logging.info(f"Text-based meal saved successfully for user {user_id}: {meal_result['meal_id']}")
                    
                    return jsonify({
                        'success': True,
                        'message': 'Meal saved successfully',
                        'data': {
                            'meal_id': meal_result['meal_id'],
                            'nutrients': nutrients,
                            'meal_name': meal_name,
                            'notes': notes,
                            'food_type': food_type,
                            'input_method': 'text'
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
            logging.error(f"Error in save text meal endpoint: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500
