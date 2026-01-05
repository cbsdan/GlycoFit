from flask import request, jsonify, g
from models.consultation import Consultation
from models.physician import Physician
from models.user import User
from models.patient_physician import PatientPhysician
from bson import ObjectId
from datetime import datetime
import logging

def create_patient_consultation():
    """Patient requests a new consultation"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json()
        
        # Validate required fields
        required_fields = ['physician_id', 'scheduled_date']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        physician_id = data['physician_id']
        
        # Verify physician exists
        physician = Physician.find_by_id(physician_id)
        if not physician:
            return jsonify({'success': False, 'message': 'Physician not found'}), 404
        
        # Verify active relationship exists
        relationship = PatientPhysician.find_by_patient_and_physician(current_user._id, physician._id)
        if not relationship or relationship.status != 'active':
            return jsonify({
                'success': False,
                'message': 'You must have an active connection with this physician'
            }), 403
        
        # Create consultation
        scheduled_date = datetime.fromisoformat(data['scheduled_date'].replace('Z', '+00:00'))
        
        consultation = Consultation(
            physician_id=physician._id,
            patient_id=current_user._id,
            consultation_type=data.get('consultation_type', 'video'),
            scheduled_date=scheduled_date,
            duration_minutes=data.get('duration_minutes', 30)
        )
        
        consultation.reason = data.get('reason', '')
        consultation.notes = data.get('notes', '')
        consultation.status = 'scheduled'
        
        consultation.save()
        
        logging.info(f"Patient {current_user._id} requested consultation with physician {physician._id}")
        
        return jsonify({
            'success': True,
            'message': 'Consultation request sent successfully',
            'data': consultation.to_safe_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating patient consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create consultation'
        }), 500

def get_patient_consultations():
    """Get patient's consultations"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        status = request.args.get('status')  # scheduled, in-progress, completed, cancelled
        physician_id = request.args.get('physician_id')
        
        # Get consultations
        consultations = Consultation.get_patient_consultations(
            current_user._id,
            status=status,
            skip=0,
            limit=100
        )
        
        # Filter by physician if specified
        if physician_id:
            consultations = [c for c in consultations if str(c.physician_id) == physician_id]
        
        # Populate physician data
        result = []
        for consultation in consultations:
            consultation_data = consultation.to_safe_dict()
            
            # Get physician and user data
            physician = Physician.find_by_id(str(consultation.physician_id))
            if physician:
                physician_user = User.find_by_id(str(physician.user_id))
                if physician_user:
                    consultation_data['physician'] = {
                        **physician.to_safe_dict(),
                        'user': {
                            'first_name': physician_user.first_name,
                            'last_name': physician_user.last_name,
                            'email': physician_user.email,
                            'avatar': physician_user.avatar
                        }
                    }
            
            result.append(consultation_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting patient consultations: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get consultations'
        }), 500

def get_patient_consultation(consultation_id):
    """Get specific consultation"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({'success': False, 'message': 'Consultation not found'}), 404
        
        # Verify ownership
        if str(consultation.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        consultation_data = consultation.to_safe_dict()
        
        # Populate physician data
        physician = Physician.find_by_id(str(consultation.physician_id))
        if physician:
            physician_user = User.find_by_id(str(physician.user_id))
            if physician_user:
                consultation_data['physician'] = {
                    **physician.to_safe_dict(),
                    'user': {
                        'first_name': physician_user.first_name,
                        'last_name': physician_user.last_name,
                        'email': physician_user.email,
                        'avatar': physician_user.avatar
                    }
                }
        
        return jsonify({
            'success': True,
            'data': consultation_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get consultation'
        }), 500

def cancel_patient_consultation(consultation_id):
    """Patient cancels a consultation"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json() or {}
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({'success': False, 'message': 'Consultation not found'}), 404
        
        # Verify ownership
        if str(consultation.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        # Can only cancel scheduled consultations
        if consultation.status != 'scheduled':
            return jsonify({
                'success': False,
                'message': f'Cannot cancel consultation with status: {consultation.status}'
            }), 400
        
        consultation.cancel_consultation(data.get('reason', 'Cancelled by patient'))
        consultation.save()
        
        logging.info(f"Patient {current_user._id} cancelled consultation {consultation_id}")
        
        return jsonify({
            'success': True,
            'message': 'Consultation cancelled successfully',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error cancelling consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to cancel consultation'
        }), 500

def reschedule_patient_consultation(consultation_id):
    """Patient reschedules a consultation"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json()
        
        if 'scheduled_date' not in data:
            return jsonify({
                'success': False,
                'message': 'scheduled_date is required'
            }), 400
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({'success': False, 'message': 'Consultation not found'}), 404
        
        # Verify ownership
        if str(consultation.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        # Can only reschedule scheduled consultations
        if consultation.status != 'scheduled':
            return jsonify({
                'success': False,
                'message': f'Cannot reschedule consultation with status: {consultation.status}'
            }), 400
        
        new_date = datetime.fromisoformat(data['scheduled_date'].replace('Z', '+00:00'))
        consultation.reschedule(new_date, data.get('duration_minutes'))
        consultation.save()
        
        logging.info(f"Patient {current_user._id} rescheduled consultation {consultation_id}")
        
        return jsonify({
            'success': True,
            'message': 'Consultation rescheduled successfully',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error rescheduling consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to reschedule consultation'
        }), 500

def rate_consultation(consultation_id):
    """Patient rates a completed consultation"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json()
        
        if 'rating' not in data:
            return jsonify({
                'success': False,
                'message': 'rating is required'
            }), 400
        
        rating = data['rating']
        if not isinstance(rating, (int, float)) or rating < 1 or rating > 5:
            return jsonify({
                'success': False,
                'message': 'rating must be between 1 and 5'
            }), 400
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({'success': False, 'message': 'Consultation not found'}), 404
        
        # Verify ownership
        if str(consultation.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        # Can only rate completed consultations
        if consultation.status != 'completed':
            return jsonify({
                'success': False,
                'message': 'Can only rate completed consultations'
            }), 400
        
        consultation.add_rating(rating, data.get('feedback', ''))
        consultation.save()
        
        logging.info(f"Patient {current_user._id} rated consultation {consultation_id}: {rating} stars")
        
        return jsonify({
            'success': True,
            'message': 'Rating submitted successfully',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error rating consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to submit rating'
        }), 500
