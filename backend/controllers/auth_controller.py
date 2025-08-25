from flask import request, jsonify
from models.user import User
from services.email_service import OTPService
from services.cloudinary_service import CloudinaryService
from config.firebase_admin import get_firebase_user, FirebaseAuth
from middleware.firebase_auth import firebase_auth_required, firebase_admin_required, get_current_user, get_current_user_id
from middleware.logging_middleware import log_database_operation, log_authentication_attempt, log_error
import logging
from datetime import datetime
import os
import tempfile

class AuthController:
    
    @staticmethod
    def generate_and_send_otp():
        """Generate and send OTP for email verification"""
        try:
            data = request.get_json()
            logging.info("OTP generation request started")
            
            email = data.get('email')
            if not email:
                logging.warning("OTP generation failed: Email is required")
                return jsonify({'error': 'Email is required'}), 400
            
            email = email.lower().strip()
            
            # Send OTP email
            success, message = OTPService.send_otp_email(email, "registration verification")
            
            if success:
                return jsonify({
                    'success': True,
                    'message': 'OTP sent to your email successfully'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': message
                }), 500
                
        except Exception as e:
            log_error(e, 'Error generating and sending OTP')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    def verify_otp():
        """Verify OTP"""
        try:
            data = request.get_json()
            logging.info("OTP verification started")
            
            email = data.get('email')
            otp = data.get('otp')
            
            if not email or not otp:
                logging.warning("OTP verification failed: Email and OTP are required")
                return jsonify({'error': 'Email and OTP are required'}), 400
            
            email = email.lower().strip()
            
            # Verify OTP
            success, message = OTPService.verify_otp(email, otp)
            
            if success:
                logging.info(f"OTP verified successfully for {email}")
                return jsonify({
                    'success': True,
                    'message': message
                }), 200
            else:
                logging.warning(f"OTP verification failed for {email}: {message}")
                return jsonify({
                    'success': False,
                    'error': message
                }), 400
                
        except Exception as e:
            log_error(e, 'Error verifying OTP')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    def register_user():
        """Register a new user with Firebase UID"""
        try:
            data = request.get_json()
            files = request.files
            logging.info("User registration started")
            
            # Extract data
            uid = data.get('uid')
            first_name = data.get('firstName')
            last_name = data.get('lastName')
            email = data.get('email')
            
            # Validate required fields
            if not all([uid, first_name, last_name, email]):
                logging.warning("Registration failed: Missing required fields")
                return jsonify({'error': 'UID, firstName, lastName, and email are required'}), 400
            
            email = email.lower().strip()
            
            # Verify the Firebase UID exists
            try:
                firebase_user_data = get_firebase_user(uid)
                if not firebase_user_data:
                    return jsonify({'error': 'Invalid Firebase UID'}), 400
                
                # Verify email matches Firebase account
                if firebase_user_data.get('email', '').lower() != email:
                    return jsonify({'error': 'Email does not match Firebase account'}), 400
                    
            except Exception as e:
                logging.error(f"Firebase UID verification failed: {str(e)}")
                return jsonify({'error': 'Invalid Firebase UID'}), 400
            
            # Check if user already exists
            existing_user = User.find_by_uid(uid)
            if existing_user:
                log_authentication_attempt(email, False, 'User with UID already exists')
                return jsonify({'error': 'User with this UID already exists'}), 409
            
            existing_email = User.find_by_email(email)
            if existing_email:
                log_authentication_attempt(email, False, 'Email already exists')
                return jsonify({'error': 'User with this email already exists'}), 409
            
            # Handle avatar upload if provided
            avatar = {'public_id': None, 'url': None}
            if 'avatar' in files:
                try:
                    avatar_file = files['avatar']
                    # Save temporarily
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                        avatar_file.save(temp_file.name)
                        
                        # Upload to Cloudinary
                        upload_result = CloudinaryService.upload_avatar(temp_file.name, uid)
                        avatar = upload_result
                        
                        # Clean up temp file
                        os.unlink(temp_file.name)
                        
                except Exception as e:
                    logging.warning(f"Avatar upload failed: {str(e)}")
                    # Continue registration without avatar
            
            # Create user
            user = User(
                uid=uid,
                first_name=first_name.strip(),
                last_name=last_name.strip(),
                email=email,
                avatar=avatar
            )
            
            # Save user
            result = user.save()
            
            # Send welcome email
            try:
                OTPService.send_welcome_email(email, first_name)
            except Exception as e:
                logging.warning(f"Failed to send welcome email: {str(e)}")
                # Don't fail registration if welcome email fails
            
            # Log successful registration
            log_authentication_attempt(email, True, 'User registered successfully')
            
            logging.info(f"User registered successfully: {email}")
            return jsonify({
                'success': True,
                'message': 'User registered successfully',
                'user': user.to_safe_dict()
            }), 201
            
        except Exception as e:
            log_error(e, 'Unexpected error during registration')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    def get_user():
        """Get user by Firebase UID"""
        try:
            data = request.get_json()
            uid = data.get('uid')
            
            logging.info(f"Getting user for UID: {uid}")
            
            if not uid:
                return jsonify({'error': 'UID is required'}), 400
            
            user = User.find_by_uid(uid)
            
            if not user:
                logging.warning(f"User not found for UID: {uid}")
                return jsonify({'error': 'User not found'}), 404
            
            # Check if user is disabled
            if user.is_currently_disabled():
                disable_record = user.get_current_disable_record()
                logging.warning(f"User {uid} is currently disabled: {disable_record.get('reason')}")
                return jsonify({
                    'success': False,
                    'error': 'Account is currently disabled',
                    'disable_info': {
                        'reason': disable_record.get('reason'),
                        'is_permanent': disable_record.get('is_permanent'),
                        'end_date': disable_record.get('end_date').isoformat() if disable_record.get('end_date') else None
                    }
                }), 403
            
            logging.info(f"User retrieved successfully: {user.email}")
            return jsonify({
                'success': True,
                'user': user.to_safe_dict()
            }), 200
            
        except Exception as e:
            log_error(e, 'Error getting user')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_admin_required
    def get_all_users():
        """Get all users (admin only)"""
        try:
            # Get pagination parameters
            page = int(request.args.get('page', 1))
            limit = int(request.args.get('limit', 50))
            skip = (page - 1) * limit
            
            logging.info(f"Getting all users - Page: {page}, Limit: {limit}")
            
            users = User.get_all_users(skip=skip, limit=limit)
            
            users_data = [user.to_safe_dict() for user in users]
            
            logging.info(f"Retrieved {len(users_data)} users")
            return jsonify({
                'success': True,
                'users': users_data,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'count': len(users_data)
                }
            }), 200
            
        except Exception as e:
            log_error(e, 'Error getting all users')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_admin_required
    def get_user_details(user_id):
        """Get user details by ID (admin only)"""
        try:
            logging.info(f"Getting user details for ID: {user_id}")
            
            user = User.find_by_id(user_id)
            
            if not user:
                logging.warning(f"User not found for ID: {user_id}")
                return jsonify({'error': 'User not found'}), 404
            
            logging.info(f"User details retrieved successfully: {user.email}")
            return jsonify({
                'success': True,
                'user': user.to_safe_dict()
            }), 200
            
        except Exception as e:
            log_error(e, 'Error getting user details')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def update_my_profile():
        """Update current user's profile"""
        try:
            current_user = get_current_user()
            data = request.get_json()
            files = request.files
            
            logging.info(f"Updating profile for user: {current_user.uid}")
            
            # Update basic fields
            update_data = {}
            if 'firstName' in data:
                update_data['first_name'] = data['firstName'].strip()
            if 'lastName' in data:
                update_data['last_name'] = data['lastName'].strip()
            if 'enablePushNotifications' in data:
                update_data['enable_push_notifications'] = data['enablePushNotifications']
            
            # Handle avatar update
            if 'avatar' in files:
                try:
                    avatar_file = files['avatar']
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                        avatar_file.save(temp_file.name)
                        
                        # Upload new avatar (will delete old one)
                        old_public_id = current_user.avatar.get('public_id') if current_user.avatar else None
                        upload_result = CloudinaryService.upload_avatar(
                            temp_file.name, 
                            current_user.uid, 
                            old_public_id
                        )
                        update_data['avatar'] = upload_result
                        
                        os.unlink(temp_file.name)
                        
                except Exception as e:
                    logging.warning(f"Avatar update failed: {str(e)}")
                    return jsonify({'error': 'Failed to update avatar'}), 500
            
            # Update user
            if update_data:
                current_user.update_profile(**update_data)
                current_user.save()
            
            logging.info(f"Profile updated successfully for user: {current_user.email}")
            return jsonify({
                'success': True,
                'message': 'Profile updated successfully',
                'user': current_user.to_safe_dict()
            }), 200
            
        except Exception as e:
            log_error(e, 'Error updating profile')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_admin_required
    def disable_user(user_id):
        """Disable user account (admin only)"""
        try:
            data = request.get_json()
            reason = data.get('reason', 'Account disabled by administrator')
            end_date = data.get('endDate')  # Optional, if not provided it's permanent
            is_permanent = data.get('isPermanent', False)
            
            logging.info(f"Disabling user: {user_id}")
            
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Parse end_date if provided
            if end_date and not is_permanent:
                try:
                    end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({'error': 'Invalid end date format'}), 400
            else:
                end_date = None
            
            # Add disable record
            disable_record = user.add_disable_record(reason, end_date, is_permanent)
            user.save()
            
            # Also disable in Firebase if possible
            try:
                FirebaseAuth.disable_user(user.uid)
            except Exception as e:
                logging.warning(f"Failed to disable Firebase user: {str(e)}")
            
            logging.info(f"User disabled successfully: {user.email}")
            return jsonify({
                'success': True,
                'message': 'User disabled successfully',
                'disable_record': {
                    'reason': disable_record.reason,
                    'is_permanent': disable_record.is_permanent,
                    'end_date': disable_record.end_date.isoformat() if disable_record.end_date else None,
                    'start_date': disable_record.start_date.isoformat()
                }
            }), 200
            
        except Exception as e:
            log_error(e, 'Error disabling user')
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_admin_required
    def enable_user(user_id):
        """Enable user account (admin only)"""
        try:
            data = request.get_json()
            reason = data.get('reason', 'Account enabled by administrator')
            
            logging.info(f"Enabling user: {user_id}")
            
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Enable user
            user.enable_user(reason)
            user.save()
            
            # Also enable in Firebase if possible
            try:
                FirebaseAuth.enable_user(user.uid)
            except Exception as e:
                logging.warning(f"Failed to enable Firebase user: {str(e)}")
            
            logging.info(f"User enabled successfully: {user.email}")
            return jsonify({
                'success': True,
                'message': 'User enabled successfully'
            }), 200
            
        except Exception as e:
            log_error(e, 'Error enabling user')
            return jsonify({'error': 'Internal server error'}), 500
