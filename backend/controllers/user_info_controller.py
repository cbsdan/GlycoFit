from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from config.database import get_db
from models.user import User
from services.cloudinary_service import CloudinaryService
from middleware.logging_middleware import log_database_operation, log_error
from middleware.firebase_auth import firebase_auth_required
import logging
from datetime import datetime
from bson import ObjectId
import tempfile
import os

class UserInfoController:
    
    @staticmethod
    @jwt_required()
    def create_user_info():
        """Create additional user information with document uploads"""
        try:
            user_id = get_jwt_identity()
            data = request.form  # Use form for file uploads
            files = request.files
            
            logging.info(f"Creating user info for user: {user_id}")
            
            db = get_db()
            
            # Check if user exists
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Prepare user info document
            user_info = {
                'user_id': ObjectId(user_id),
                'date_of_birth': data.get('dateOfBirth'),
                'diabetes_type': data.get('diabetesType'),
                'diagnosis_date': data.get('diagnosisDate'),
                'emergency_contact': {
                    'name': data.get('emergencyContactName'),
                    'phone': data.get('emergencyContactPhone'),
                    'relationship': data.get('emergencyContactRelationship')
                },
                'medical_info': {
                    'medications': data.getlist('medications[]') if data.getlist('medications[]') else [],
                    'allergies': data.getlist('allergies[]') if data.getlist('allergies[]') else [],
                    'doctor_name': data.get('doctorName'),
                    'doctor_phone': data.get('doctorPhone')
                },
                'target_glucose_range': {
                    'min': int(data.get('targetGlucoseMin', 70)),
                    'max': int(data.get('targetGlucoseMax', 180))
                },
                'documents': {},
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            # Handle document uploads
            document_fields = ['frontSide', 'backSide', 'selfie']
            for field in document_fields:
                if field in files:
                    try:
                        file = files[field]
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                            file.save(temp_file.name)
                            
                            # Upload to Cloudinary
                            upload_result = CloudinaryService.upload_image(
                                file_path=temp_file.name,
                                folder='user_documents',
                                public_id=f"{field}_{user_id}_{int(datetime.now().timestamp())}"
                            )
                            
                            if upload_result['success']:
                                user_info['documents'][field] = {
                                    'public_id': upload_result['public_id'],
                                    'url': upload_result['url']
                                }
                            
                            os.unlink(temp_file.name)
                            
                    except Exception as e:
                        logging.warning(f"Failed to upload {field}: {str(e)}")
            
            # Insert user info
            result = db.user_info.insert_one(user_info)
            log_database_operation('insert_one', 'user_info', user_info, result)
            
            # Format response
            user_info['_id'] = str(result.inserted_id)
            user_info['user_id'] = str(user_info['user_id'])
            user_info['created_at'] = user_info['created_at'].isoformat()
            user_info['updated_at'] = user_info['updated_at'].isoformat()
            
            logging.info(f"User info created successfully for user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'User information created successfully',
                'user_info': user_info
            }), 201
            
        except Exception as e:
            log_error(e, 'Error creating user info')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @jwt_required()
    def get_user_info(info_user_id=None):
        """Get user information"""
        try:
            current_user_id = get_jwt_identity()
            target_user_id = info_user_id or current_user_id
            
            logging.info(f"Getting user info for user: {target_user_id}")
            
            db = get_db()
            
            # Find user info
            user_info = db.user_info.find_one({'user_id': ObjectId(target_user_id)})
            log_database_operation('find_one', 'user_info', {'user_id': target_user_id}, user_info)
            
            if not user_info:
                return jsonify({'error': 'User information not found'}), 404
            
            # Format response
            user_info['_id'] = str(user_info['_id'])
            user_info['user_id'] = str(user_info['user_id'])
            if user_info.get('created_at'):
                user_info['created_at'] = user_info['created_at'].isoformat()
            if user_info.get('updated_at'):
                user_info['updated_at'] = user_info['updated_at'].isoformat()
            
            logging.info(f"User info retrieved successfully for user: {target_user_id}")
            return jsonify({
                'success': True,
                'user_info': user_info
            }), 200
            
        except Exception as e:
            log_error(e, 'Error getting user info')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @jwt_required()
    def get_all_user_info():
        """Get all user information (admin only)"""
        try:
            current_user_id = get_jwt_identity()
            
            # Check if user is admin
            user = User.find_by_id(current_user_id)
            if not user or user.role != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            
            logging.info("Getting all user info (admin request)")
            
            db = get_db()
            
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            limit = int(request.args.get('limit', 50))
            skip = (page - 1) * limit
            
            # Get all user info
            user_infos = list(db.user_info.find().skip(skip).limit(limit))
            log_database_operation('find', 'user_info', {'skip': skip, 'limit': limit}, user_infos)
            
            # Format response
            for info in user_infos:
                info['_id'] = str(info['_id'])
                info['user_id'] = str(info['user_id'])
                if info.get('created_at'):
                    info['created_at'] = info['created_at'].isoformat()
                if info.get('updated_at'):
                    info['updated_at'] = info['updated_at'].isoformat()
            
            logging.info(f"Retrieved {len(user_infos)} user info records")
            return jsonify({
                'success': True,
                'user_infos': user_infos,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'count': len(user_infos)
                }
            }), 200
            
        except Exception as e:
            log_error(e, 'Error getting all user info')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @jwt_required()
    def update_user_info(info_id):
        """Update user information"""
        try:
            current_user_id = get_jwt_identity()
            data = request.form
            files = request.files
            
            logging.info(f"Updating user info: {info_id}")
            
            db = get_db()
            
            # Find existing user info
            user_info = db.user_info.find_one({'_id': ObjectId(info_id)})
            if not user_info:
                return jsonify({'error': 'User information not found'}), 404
            
            # Check if user owns this info or is admin
            user = User.find_by_id(current_user_id)
            if str(user_info['user_id']) != current_user_id and user.role != 'admin':
                return jsonify({'error': 'Access denied'}), 403
            
            # Prepare update data
            update_data = {'updated_at': datetime.utcnow()}
            
            # Update fields if provided
            if data.get('dateOfBirth'):
                update_data['date_of_birth'] = data.get('dateOfBirth')
            if data.get('diabetesType'):
                update_data['diabetes_type'] = data.get('diabetesType')
            if data.get('diagnosisDate'):
                update_data['diagnosis_date'] = data.get('diagnosisDate')
            
            # Update emergency contact
            emergency_contact = {}
            if data.get('emergencyContactName'):
                emergency_contact['name'] = data.get('emergencyContactName')
            if data.get('emergencyContactPhone'):
                emergency_contact['phone'] = data.get('emergencyContactPhone')
            if data.get('emergencyContactRelationship'):
                emergency_contact['relationship'] = data.get('emergencyContactRelationship')
            if emergency_contact:
                update_data['emergency_contact'] = emergency_contact
            
            # Update medical info
            medical_info = {}
            if data.getlist('medications[]'):
                medical_info['medications'] = data.getlist('medications[]')
            if data.getlist('allergies[]'):
                medical_info['allergies'] = data.getlist('allergies[]')
            if data.get('doctorName'):
                medical_info['doctor_name'] = data.get('doctorName')
            if data.get('doctorPhone'):
                medical_info['doctor_phone'] = data.get('doctorPhone')
            if medical_info:
                update_data['medical_info'] = medical_info
            
            # Update target glucose range
            if data.get('targetGlucoseMin') or data.get('targetGlucoseMax'):
                target_range = user_info.get('target_glucose_range', {})
                if data.get('targetGlucoseMin'):
                    target_range['min'] = int(data.get('targetGlucoseMin'))
                if data.get('targetGlucoseMax'):
                    target_range['max'] = int(data.get('targetGlucoseMax'))
                update_data['target_glucose_range'] = target_range
            
            # Handle document updates
            document_fields = ['frontSide', 'backSide', 'selfie']
            documents = user_info.get('documents', {})
            
            for field in document_fields:
                if field in files:
                    try:
                        # Delete old document if exists
                        if field in documents and documents[field].get('public_id'):
                            CloudinaryService.delete_image(documents[field]['public_id'])
                        
                        # Upload new document
                        file = files[field]
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                            file.save(temp_file.name)
                            
                            upload_result = CloudinaryService.upload_image(
                                file_path=temp_file.name,
                                folder='user_documents',
                                public_id=f"{field}_{user_info['user_id']}_{int(datetime.now().timestamp())}"
                            )
                            
                            if upload_result['success']:
                                documents[field] = {
                                    'public_id': upload_result['public_id'],
                                    'url': upload_result['url']
                                }
                            
                            os.unlink(temp_file.name)
                            
                    except Exception as e:
                        logging.warning(f"Failed to update {field}: {str(e)}")
            
            if documents:
                update_data['documents'] = documents
            
            # Update user info
            result = db.user_info.update_one(
                {'_id': ObjectId(info_id)},
                {'$set': update_data}
            )
            log_database_operation('update_one', 'user_info', {'_id': info_id}, result)
            
            # Get updated user info
            updated_info = db.user_info.find_one({'_id': ObjectId(info_id)})
            
            # Format response
            updated_info['_id'] = str(updated_info['_id'])
            updated_info['user_id'] = str(updated_info['user_id'])
            updated_info['created_at'] = updated_info['created_at'].isoformat()
            updated_info['updated_at'] = updated_info['updated_at'].isoformat()
            
            logging.info(f"User info updated successfully: {info_id}")
            return jsonify({
                'success': True,
                'message': 'User information updated successfully',
                'user_info': updated_info
            }), 200
            
        except Exception as e:
            log_error(e, 'Error updating user info')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @jwt_required()
    def delete_user_info(info_id):
        """Delete user information"""
        try:
            current_user_id = get_jwt_identity()
            
            logging.info(f"Deleting user info: {info_id}")
            
            db = get_db()
            
            # Find existing user info
            user_info = db.user_info.find_one({'_id': ObjectId(info_id)})
            if not user_info:
                return jsonify({'error': 'User information not found'}), 404
            
            # Check if user owns this info or is admin
            user = User.find_by_id(current_user_id)
            if str(user_info['user_id']) != current_user_id and user.role != 'admin':
                return jsonify({'error': 'Access denied'}), 403
            
            # Delete documents from Cloudinary
            documents = user_info.get('documents', {})
            for field, doc_info in documents.items():
                if doc_info.get('public_id'):
                    try:
                        CloudinaryService.delete_image(doc_info['public_id'])
                    except Exception as e:
                        logging.warning(f"Failed to delete document {field}: {str(e)}")
            
            # Delete user info
            result = db.user_info.delete_one({'_id': ObjectId(info_id)})
            log_database_operation('delete_one', 'user_info', {'_id': info_id}, result)
            
            logging.info(f"User info deleted successfully: {info_id}")
            return jsonify({
                'success': True,
                'message': 'User information deleted successfully'
            }), 200
            
        except Exception as e:
            log_error(e, 'Error deleting user info')
            return jsonify({'error': 'Internal server error'}), 500

    @staticmethod
    @firebase_auth_required
    def save_fcm_token():
        """Save or update FCM token for push notifications"""
        try:
            user_id = request.current_user_id
            data = request.get_json()
            fcm_token = data.get('fcmToken')
            
            if not fcm_token:
                return jsonify({'error': 'FCM token is required'}), 400
            
            logging.info(f"Saving FCM token for user: {user_id}")
            
            db = get_db()
            
            # Check if user exists
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Update user's push_tokens array (add if not exists, avoid duplicates)
            result = db.users.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$addToSet': {'push_tokens': fcm_token},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            log_database_operation('update_one', 'users', {'fcm_token': fcm_token}, result)
            
            logging.info(f"FCM token saved successfully for user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'FCM token saved successfully'
            }), 200
            
        except Exception as e:
            log_error(e, 'Error saving FCM token')
            return jsonify({'error': 'Internal server error'}), 500

    @staticmethod
    @firebase_auth_required
    def delete_fcm_token():
        """Delete FCM token (e.g., on logout)"""
        try:
            user_id = request.current_user_id
            data = request.get_json() or {}
            fcm_token = data.get('fcmToken')
            
            logging.info(f"Deleting FCM token for user: {user_id}")
            
            db = get_db()
            
            # Check if user exists
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # If specific token provided, remove only that token
            # Otherwise, clear all tokens
            if fcm_token:
                result = db.users.update_one(
                    {'_id': ObjectId(user_id)},
                    {
                        '$pull': {'push_tokens': fcm_token},
                        '$set': {'updated_at': datetime.utcnow()}
                    }
                )
            else:
                result = db.users.update_one(
                    {'_id': ObjectId(user_id)},
                    {
                        '$set': {
                            'push_tokens': [],
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
            
            log_database_operation('update_one', 'users', {'delete_fcm_token': True}, result)
            
            logging.info(f"FCM token deleted successfully for user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'FCM token deleted successfully'
            }), 200
            
        except Exception as e:
            log_error(e, 'Error deleting FCM token')
            return jsonify({'error': 'Internal server error'}), 500

    @staticmethod
    @firebase_auth_required
    def update_health_metrics():
        """Update user health metrics (age, sex, height, weight)"""
        try:
            user_id = request.current_user_id
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'Request body is required'}), 400
            
            logging.info(f"Updating health metrics for user: {user_id}")
            
            # Find user
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Validate and update health metrics
            update_data = {}
            
            # Age validation
            if 'age' in data:
                age = data.get('age')
                if age is not None:
                    if not isinstance(age, (int, float)) or age < 0 or age > 150:
                        return jsonify({'error': 'Age must be a number between 0 and 150'}), 400
                    update_data['age'] = int(age)
                else:
                    update_data['age'] = None
            
            # Sex/Gender validation
            if 'sex' in data:
                sex = data.get('sex')
                if sex is not None:
                    if sex.lower() not in ['male', 'female', 'other']:
                        return jsonify({'error': 'Sex must be male, female, or other'}), 400
                    update_data['sex'] = sex.lower()
                else:
                    update_data['sex'] = None
            
            # Height validation (in cm)
            if 'height' in data:
                height = data.get('height')
                if height is not None:
                    if not isinstance(height, (int, float)) or height < 0 or height > 300:
                        return jsonify({'error': 'Height must be a number between 0 and 300 cm'}), 400
                    update_data['height'] = float(height)
                else:
                    update_data['height'] = None
            
            # Weight validation (in kg)
            if 'weight' in data:
                weight = data.get('weight')
                if weight is not None:
                    if not isinstance(weight, (int, float)) or weight < 0 or weight > 500:
                        return jsonify({'error': 'Weight must be a number between 0 and 500 kg'}), 400
                    update_data['weight'] = float(weight)
                else:
                    update_data['weight'] = None
            
            # Diagnosis status validation
            if 'diagnosis_status' in data:
                diagnosis_status = data.get('diagnosis_status')
                if diagnosis_status is not None:
                    valid_statuses = ['not_diagnosed', 'prediabetes', 'type2_diabetes']
                    if diagnosis_status not in valid_statuses:
                        return jsonify({'error': f'Diagnosis status must be one of: {", ".join(valid_statuses)}'}), 400
                    update_data['diagnosis_status'] = diagnosis_status
                else:
                    update_data['diagnosis_status'] = None
            
            if not update_data:
                return jsonify({'error': 'No valid fields to update'}), 400
            
            # Update user profile
            user.update_profile(**update_data)
            user.save()
            
            # Calculate BMI if both height and weight are available
            bmi = None
            if user.height and user.weight and user.height > 0:
                height_m = user.height / 100  # Convert cm to meters
                bmi = round(user.weight / (height_m ** 2), 2)
            
            logging.info(f"Health metrics updated successfully for user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'Health metrics updated successfully',
                'user': user.to_safe_dict(),
                'bmi': bmi
            }), 200
            
        except Exception as e:
            log_error(e, 'Error updating health metrics')
            return jsonify({'error': 'Internal server error'}), 500

    @staticmethod
    @firebase_auth_required
    def get_health_metrics():
        """Get user health metrics including calculated BMI"""
        try:
            user_id = request.current_user_id
            
            logging.info(f"Getting health metrics for user: {user_id}")
            
            # Find user
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Calculate BMI if both height and weight are available
            bmi = None
            bmi_category = None
            if user.height and user.weight and user.height > 0:
                height_m = user.height / 100  # Convert cm to meters
                bmi = round(user.weight / (height_m ** 2), 2)
                
                # Determine BMI category
                if bmi < 18.5:
                    bmi_category = 'Underweight'
                elif bmi < 25:
                    bmi_category = 'Normal weight'
                elif bmi < 30:
                    bmi_category = 'Overweight'
                else:
                    bmi_category = 'Obese'
            
            health_metrics = {
                'age': user.age,
                'sex': user.sex,
                'height': user.height,
                'weight': user.weight,
                'bmi': bmi,
                'bmi_category': bmi_category,
                'diagnosis_status': getattr(user, 'diagnosis_status', 'not_diagnosed')
            }
            
            logging.info(f"Health metrics retrieved successfully for user: {user_id}")
            return jsonify({
                'success': True,
                'health_metrics': health_metrics
            }), 200
            
        except Exception as e:
            log_error(e, 'Error getting health metrics')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    def update_disclaimer_status():
        """Update user's disclaimer acceptance status"""
        try:
            user_id = request.current_user_id
            data = request.get_json()
            
            if not data or 'accepted' not in data:
                return jsonify({'error': 'Disclaimer acceptance status is required'}), 400
            
            accepted = data.get('accepted')
            
            logging.info(f"Updating disclaimer status for user {user_id}: {accepted}")
            
            # Find user
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Update disclaimer status
            user.update_profile(disclaimer_accepted=accepted)
            user.save()
            
            logging.info(f"Disclaimer status updated successfully for user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'Disclaimer status updated successfully',
                'disclaimer_accepted': user.disclaimer_accepted
            }), 200
            
        except Exception as e:
            log_error(e, 'Error updating disclaimer status')
            return jsonify({'error': 'Internal server error'}), 500
