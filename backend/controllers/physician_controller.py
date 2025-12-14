from flask import request, jsonify, g
from models.user import User
from models.physician import Physician
from models.patient_physician import PatientPhysician
from models.consultation import Consultation
from models.prescription import Prescription
from models.appointment import Appointment
from services.cloudinary_service import CloudinaryService
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import os
from werkzeug.utils import secure_filename

def get_physician_profile():
    """Get current physician's profile"""
    try:
        current_user = g.current_user
        
        # Get physician data
        physician = Physician.find_by_user_id(current_user._id)
        
        # Auto-create physician profile if it doesn't exist
        if not physician:
            logging.info(f"Creating physician profile for user: {current_user.email}")
            physician = Physician(
                user_id=current_user._id,
                specialization='General Practice',  # Default value
                license_number='',  # Can be updated later
                years_of_experience=0
            )
            physician.save()
            logging.info(f"Physician profile created successfully")
        
        # Combine user and physician data
        profile_data = current_user.to_safe_dict()
        profile_data['physician_info'] = physician.to_safe_dict()
        
        return jsonify({
            'success': True,
            'data': profile_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting physician profile: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get physician profile'
        }), 500

def update_physician_profile():
    """Update physician profile"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        physician = Physician.find_by_user_id(current_user._id)
        
        # Auto-create physician profile if it doesn't exist
        if not physician:
            logging.info(f"Creating physician profile for user: {current_user.email}")
            physician = Physician(
                user_id=current_user._id,
                specialization='General Practice',
                license_number='',
                years_of_experience=0
            )
        
        # Update allowed fields
        allowed_fields = ['specialization', 'bio', 'languages', 'consultation_fee', 
                         'working_hours', 'education', 'certifications', 'license_number', 
                         'years_of_experience']
        
        logging.info(f"Update request data: {data}")
        
        updated_fields = []
        for field in allowed_fields:
            if field in data:
                old_value = getattr(physician, field, None)
                setattr(physician, field, data[field])
                new_value = getattr(physician, field)
                updated_fields.append(f"{field}: {old_value} -> {new_value}")
        
        # Ensure updated_at is set
        physician.updated_at = datetime.utcnow()
        
        logging.info(f"Updated fields: {updated_fields}")
        
        save_result = physician.save()
        logging.info(f"Save result: {save_result.modified_count if hasattr(save_result, 'modified_count') else 'inserted'}")
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'data': physician.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error updating physician profile: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to update profile'
        }), 500

def update_availability():
    """Update physician availability status"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        if 'is_active' not in data:
            return jsonify({
                'success': False,
                'message': 'is_active field is required'
            }), 400
        
        physician = Physician.find_by_user_id(current_user._id)
        
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        physician.update_availability(data['is_active'])
        physician.save()
        
        return jsonify({
            'success': True,
            'message': 'Availability updated successfully',
            'data': {
                'is_active': physician.is_active
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Error updating availability: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to update availability'
        }), 500

def get_physician_stats():
    """Get physician statistics"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        
        # Auto-create physician profile if it doesn't exist
        if not physician:
            logging.info(f"Creating physician profile for user: {current_user.email}")
            physician = Physician(
                user_id=current_user._id,
                specialization='General Practice',
                license_number='',
                years_of_experience=0
            )
            physician.save()
            logging.info(f"Physician profile created successfully")
        
        # Get patient statistics
        total_patients = len(PatientPhysician.get_physician_patients(physician._id, status='active'))
        pending_requests = len(PatientPhysician.get_physician_patients(physician._id, status='pending'))
        
        # Get today's appointments
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        today_appointments = len(Appointment.get_physician_appointments(
            physician._id, 
            start_date=today_start, 
            end_date=today_end
        ))
        
        # Get total consultations
        total_consultations = physician.total_consultations
        
        stats = {
            'total_patients': total_patients,
            'active_patients': total_patients,  # Currently same as total
            'pending_requests': pending_requests,
            'today_appointments': today_appointments,
            'total_consultations': total_consultations,
            'rating': physician.rating
        }
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting physician stats: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get statistics'
        }), 500

def upload_profile_picture():
    """Upload physician profile picture"""
    try:
        current_user = g.current_user
        
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file provided'
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        import tempfile
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        file.save(temp_path)
        
        try:
            # Upload to Cloudinary
            old_public_id = None
            if current_user.avatar and current_user.avatar.get('public_id'):
                old_public_id = current_user.avatar['public_id']
            
            result = CloudinaryService.upload_avatar(
                file_path=temp_path,
                user_id=str(current_user._id),
                old_public_id=old_public_id
            )
            
            # Update user profile
            current_user.avatar = {
                'url': result['url'],
                'public_id': result['public_id']
            }
            current_user.updated_at = datetime.utcnow()
            current_user.save()
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            return jsonify({
                'success': True,
                'message': 'Profile picture updated successfully',
                'data': {
                    'avatar': {
                        'url': result['url'],
                        'public_id': result['public_id']
                    }
                }
            }), 200
            
        except Exception as upload_error:
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise upload_error
            
    except Exception as e:
        logging.error(f"Error uploading profile picture: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to upload profile picture'
        }), 500

def save_physician_fcm_token():
    """Save FCM token for push notifications"""
    try:
        current_user = g.current_user
        data = request.get_json()
        fcm_token = data.get('fcmToken')
        
        if not fcm_token:
            return jsonify({'error': 'FCM token is required'}), 400
        
        logging.info(f"Saving FCM token for physician: {current_user._id}")
        
        from config.database import get_db
        db = get_db()
        
        # Save token to physicians collection (not users collection)
        result = db.physicians.update_one(
            {'user_id': ObjectId(current_user._id)},
            {
                '$addToSet': {'push_tokens': fcm_token},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        logging.info(f"FCM token saved successfully for physician: {current_user._id}")
        return jsonify({
            'success': True,
            'message': 'FCM token saved successfully'
        }), 200
        
    except Exception as e:
        logging.error(f"Error saving FCM token: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

def delete_physician_fcm_token():
    """Delete FCM token (e.g., on logout)"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        fcm_token = data.get('fcmToken')
        
        logging.info(f"Deleting FCM token for physician: {current_user._id}")
        
        from config.database import get_db
        db = get_db()
        
        # If specific token provided, remove only that token
        # Otherwise, clear all tokens
        if fcm_token:
            result = db.physicians.update_one(
                {'user_id': ObjectId(current_user._id)},
                {
                    '$pull': {'push_tokens': fcm_token},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
        else:
            result = db.physicians.update_one(
                {'user_id': ObjectId(current_user._id)},
                {
                    '$set': {
                        'push_tokens': [],
                        'updated_at': datetime.utcnow()
                    }
                }
            )
        
        logging.info(f"FCM token deleted successfully for physician: {current_user._id}")
        return jsonify({
            'success': True,
            'message': 'FCM token deleted successfully'
        }), 200
        
    except Exception as e:
        logging.error(f"Error deleting FCM token: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
