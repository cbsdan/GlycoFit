from flask import request, jsonify, g
from models.consultation import Consultation
from datetime import datetime
import logging
from services.cloudinary_service import CloudinaryService
import os
import tempfile

def log_user_vitals():
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'message': 'User not authenticated'}), 401
            
        # Handle both JSON and multipart/form-data
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Multipart form data with possible image
            data = request.form.to_dict()
            image_file = request.files.get('image')
            image_url = None
            image_public_id = None
            
            if image_file:
                # Save temp file and upload to Cloudinary
                temp_fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(image_file.filename or 'image.jpg')[1])
                try:
                    with os.fdopen(temp_fd, 'wb') as f:
                        f.write(image_file.read())
                    
                    upload_result = CloudinaryService.upload_image(
                        file_path=temp_path,
                        folder='blood_results',
                        public_id=f"blood_result_{current_user._id}_{int(datetime.utcnow().timestamp())}"
                    )
                    
                    if upload_result['success']:
                        image_url = upload_result['url']
                        image_public_id = upload_result['public_id']
                    else:
                        logging.error(f"Failed to upload image: {upload_result['error']}")
                finally:
                    # Make sure temp file is cleaned up even if Windows locks it temporarily
                    try:
                        os.unlink(temp_path)
                    except Exception as clean_err:
                        logging.warning(f"Could not immediately delete temp file {temp_path}: {str(clean_err)}")
        else:
            # JSON data
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'message': 'No data provided'}), 400
            image_url = data.get('image_url')
            image_public_id = data.get('image_public_id')

        # Create consultation record for vitals
        consultation = Consultation(
            physician_id=None,
            patient_id=current_user._id,
            consultation_type='in-person',
            scheduled_date=datetime.utcnow(),
            duration_minutes=0
        )
        consultation.consultation_mode = 'quick_vitals'
        consultation.status = Consultation.STATUS_COMPLETED
        consultation.actual_start_time = datetime.utcnow()
        consultation.actual_end_time = datetime.utcnow()

        consultation.source = 'user'
        consultation.source_id = str(current_user._id)
        consultation.source_name = f"{current_user.first_name} {current_user.last_name}".strip()

        consultation.soap_objective = {
            'ogtt': data.get('ogtt'),
            'fasting_blood_sugar': data.get('fasting_blood_sugar'),
            'hba1c': data.get('hba1c'),
            'image_url': image_url,
            'image_public_id': image_public_id,
        }
        
        consultation.save()

        return jsonify({
            'success': True,
            'message': 'Vitals logged successfully',
            'data': consultation.to_safe_dict()
        }), 201

    except Exception as e:
        logging.error(f"Error logging vitals: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to log vitals'}), 500

def get_user_vitals():
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'message': 'User not authenticated'}), 401
            
        from config.database import get_db
        from bson import ObjectId
        db = get_db()
        
        query = {
            'patient_id': current_user._id,
            'consultation_mode': 'quick_vitals'
        }

        notes_data = list(
            db.consultations.find(query).sort('created_at', -1).limit(50)
        )

        results = []
        for doc in notes_data:
            consultation = Consultation.from_dict(doc)
            consultation._id = doc['_id']
            results.append(consultation.to_safe_dict())

        return jsonify({
            'success': True,
            'data': results,
            'count': len(results)
        }), 200

    except Exception as e:
        logging.error(f"Error fetching SOAP notes: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to get notes'}), 500

def update_user_vital(vital_id):
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'message': 'User not authenticated'}), 401
            
        from config.database import get_db
        from bson import ObjectId
        db = get_db()
        
        try:
            vital_obj_id = ObjectId(vital_id)
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid vital ID'}), 400
            
        existing_vital = db.consultations.find_one({
            '_id': vital_obj_id,
            'patient_id': current_user._id,
            'source': 'user',
            'consultation_mode': 'quick_vitals'
        })
        
        if not existing_vital:
            return jsonify({'success': False, 'message': 'Vital record not found or access denied'}), 404
            
        # Handle both JSON and multipart/form-data
        data = {}
        image_url = existing_vital.get('soap_objective', {}).get('image_url')
        image_public_id = existing_vital.get('soap_objective', {}).get('image_public_id')
        
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            image_file = request.files.get('image')
            
            if image_file:
                # Delete old image if it exists
                if image_public_id:
                    try:
                        CloudinaryService.delete_image(image_public_id)
                    except Exception as e:
                        logging.warning(f"Failed to delete old image {image_public_id}: {str(e)}")
                        
                temp_fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(image_file.filename or 'image.jpg')[1])
                try:
                    with os.fdopen(temp_fd, 'wb') as f:
                        f.write(image_file.read())
                        
                    upload_result = CloudinaryService.upload_image(
                        file_path=temp_path,
                        folder='blood_results',
                        public_id=f"blood_result_{current_user._id}_{int(datetime.utcnow().timestamp())}"
                    )
                    
                    if upload_result['success']:
                        image_url = upload_result['url']
                        image_public_id = upload_result['public_id']
                finally:
                    try:
                        os.unlink(temp_path)
                    except Exception as clean_err:
                        pass
        else:
            data = request.get_json() or {}
            
        # Update soap_objective
        soap_objective = existing_vital.get('soap_objective', {})
        if 'ogtt' in data: soap_objective['ogtt'] = data['ogtt']
        if 'fasting_blood_sugar' in data: soap_objective['fasting_blood_sugar'] = data['fasting_blood_sugar']
        if 'hba1c' in data: soap_objective['hba1c'] = data['hba1c']
        
        soap_objective['image_url'] = image_url
        soap_objective['image_public_id'] = image_public_id
        
        db.consultations.update_one(
            {'_id': vital_obj_id},
            {
                '$set': {
                    'soap_objective': soap_objective,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        updated = db.consultations.find_one({'_id': vital_obj_id})
        consultation = Consultation.from_dict(updated)
        consultation._id = updated['_id']
        
        return jsonify({
            'success': True,
            'message': 'Vital updated successfully',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error updating vital: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update vital'}), 500
        
def delete_user_vital(vital_id):
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'message': 'User not authenticated'}), 401
            
        from config.database import get_db
        from bson import ObjectId
        db = get_db()
        
        try:
            vital_obj_id = ObjectId(vital_id)
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid vital ID'}), 400
            
        existing_vital = db.consultations.find_one({
            '_id': vital_obj_id,
            'patient_id': current_user._id,
            'source': 'user',
            'consultation_mode': 'quick_vitals'
        })
        
        if not existing_vital:
            return jsonify({'success': False, 'message': 'Vital record not found or access denied'}), 404
            
        # Delete image if it exists
        image_public_id = existing_vital.get('soap_objective', {}).get('image_public_id')
        if image_public_id:
            try:
                CloudinaryService.delete_image(image_public_id)
            except Exception as e:
                logging.warning(f"Failed to delete old image {image_public_id}: {str(e)}")
                
        db.consultations.delete_one({'_id': vital_obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Vital deleted successfully'
        }), 200
        
    except Exception as e:
        logging.error(f"Error deleting vital: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete vital'}), 500
