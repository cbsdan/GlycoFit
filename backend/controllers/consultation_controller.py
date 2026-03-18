from flask import request, jsonify, g
from models.physician import Physician
from models.consultation import Consultation
from models.user import User
from bson import ObjectId
from datetime import datetime
import logging

def create_consultation():
    """Create a new consultation"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        physician = Physician.find_by_user_id(current_user._id)
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
        
        # Validate required fields
        required_fields = ['patient_id', 'scheduled_date']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        # Create consultation
        scheduled_date = datetime.fromisoformat(data['scheduled_date'].replace('Z', '+00:00'))
        
        consultation = Consultation(
            physician_id=physician._id,
            patient_id=ObjectId(data['patient_id']),
            consultation_type=data.get('consultation_type', 'video'),
            scheduled_date=scheduled_date,
            duration_minutes=data.get('duration_minutes', 30)
        )
        
        consultation.reason = data.get('reason', '')
        consultation.notes = data.get('notes', '')
        consultation.meeting_url = data.get('meeting_url', '')
        consultation.meeting_id = data.get('meeting_id', '')
        
        consultation.save()
        
        return jsonify({
            'success': True,
            'message': 'Consultation created successfully',
            'data': consultation.to_safe_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create consultation'
        }), 500

def get_consultations():
    """Get consultations for physician"""
    try:
        current_user = g.current_user
        status = request.args.get('status')  # scheduled, in-progress, completed, cancelled
        date_str = request.args.get('date')
        patient_id_str = request.args.get('patient_id')
        
        physician = Physician.find_by_user_id(current_user._id)
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
        
        start_date = None
        end_date = None
        
        if date_str:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            start_date = date.replace(hour=0, minute=0, second=0)
            end_date = date.replace(hour=23, minute=59, second=59)
        
        consultations = Consultation.get_physician_consultations(
            physician._id,
            status=status,
            start_date=start_date,
            end_date=end_date
        )
        
        # Populate patient data
        result = []
        for consultation in consultations:
            consultation_data = consultation.to_safe_dict()
            patient = User.find_by_id(str(consultation.patient_id))
            if patient:
                consultation_data['patient'] = patient.to_safe_dict()
            result.append(consultation_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting consultations: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get consultations'
        }), 500

def get_consultation(consultation_id):
    """Get specific consultation"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({
                'success': False,
                'message': 'Consultation not found'
            }), 404
        
        # Verify physician owns this consultation
        if str(consultation.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        consultation_data = consultation.to_safe_dict()
        patient = User.find_by_id(str(consultation.patient_id))
        if patient:
            consultation_data['patient'] = patient.to_safe_dict()
        
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

def start_consultation(consultation_id):
    """Start a consultation"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({
                'success': False,
                'message': 'Consultation not found'
            }), 404
        
        if str(consultation.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        consultation.start_consultation()
        consultation.save()
        
        return jsonify({
            'success': True,
            'message': 'Consultation started',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error starting consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to start consultation'
        }), 500

def complete_consultation(consultation_id):
    """Complete a consultation"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({
                'success': False,
                'message': 'Consultation not found'
            }), 404
        
        if str(consultation.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        consultation.complete_consultation(
            notes=data.get('notes', ''),
            diagnosis=data.get('diagnosis', ''),
            treatment_plan=data.get('treatment_plan', ''),
            follow_up_required=data.get('follow_up_required', False)
        )
        consultation.save()
        
        # Update physician stats
        physician.total_consultations += 1
        physician.save()
        
        return jsonify({
            'success': True,
            'message': 'Consultation completed',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error completing consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to complete consultation'
        }), 500

def cancel_consultation(consultation_id):
    """Cancel a consultation"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({
                'success': False,
                'message': 'Consultation not found'
            }), 404
        
        if str(consultation.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        consultation.cancel_consultation(data.get('reason', ''))
        consultation.save()
        
        return jsonify({
            'success': True,
            'message': 'Consultation cancelled',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error cancelling consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to cancel consultation'
        }), 500

def reschedule_consultation(consultation_id):
    """Reschedule a consultation"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        if 'scheduled_date' not in data:
            return jsonify({
                'success': False,
                'message': 'scheduled_date is required'
            }), 400
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({
                'success': False,
                'message': 'Consultation not found'
            }), 404
        
        if str(consultation.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        new_date = datetime.fromisoformat(data['scheduled_date'].replace('Z', '+00:00'))
        consultation.reschedule(new_date, data.get('duration_minutes'))
        consultation.save()
        
        return jsonify({
            'success': True,
            'message': 'Consultation rescheduled',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error rescheduling consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to reschedule consultation'
        }), 500


def get_pending_consultation_requests():
    """Get pending consultation requests for physician"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultations = Consultation.get_pending_for_physician(physician._id)
        
        # Populate patient data
        result = []
        for consultation in consultations:
            consultation_data = consultation.to_safe_dict()
            patient = User.find_by_id(str(consultation.patient_id))
            if patient:
                consultation_data['patient'] = patient.to_safe_dict()
            result.append(consultation_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting pending consultation requests: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get pending requests'
        }), 500


def approve_consultation(consultation_id):
    """Physician approves a consultation request"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({
                'success': False,
                'message': 'Consultation not found'
            }), 404
        
        if str(consultation.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Check if consultation is in pending status
        if consultation.status != Consultation.STATUS_PENDING:
            return jsonify({
                'success': False,
                'message': f'Cannot approve consultation with status: {consultation.status}'
            }), 400
        
        # Parse new date if provided
        scheduled_date = None
        if 'scheduled_date' in data:
            scheduled_date = datetime.fromisoformat(data['scheduled_date'].replace('Z', '+00:00'))
        
        # Approve the consultation (no meeting link required)
        consultation.approve(
            scheduled_date=scheduled_date,
            scheduled_time=data.get('scheduled_time')
        )
        consultation.save()
        
        logging.info(f"Consultation {consultation_id} approved by physician {physician._id}")
        
        # TODO: Send notification to patient about approved consultation
        
        return jsonify({
            'success': True,
            'message': 'Consultation approved successfully',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error approving consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to approve consultation'
        }), 500


def reject_consultation(consultation_id):
    """Physician rejects a consultation request"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        consultation = Consultation.find_by_id(consultation_id)
        
        if not consultation:
            return jsonify({
                'success': False,
                'message': 'Consultation not found'
            }), 404
        
        if str(consultation.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Check if consultation is in pending status
        if consultation.status != Consultation.STATUS_PENDING:
            return jsonify({
                'success': False,
                'message': f'Cannot reject consultation with status: {consultation.status}'
            }), 400
        
        # Reject the consultation
        consultation.reject(reason=data.get('reason', ''))
        consultation.save()
        
        logging.info(f"Consultation {consultation_id} rejected by physician {physician._id}")
        
        # TODO: Send notification to patient about rejected consultation
        
        return jsonify({
            'success': True,
            'message': 'Consultation rejected',
            'data': consultation.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error rejecting consultation: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to reject consultation'
        }), 500


def get_physician_schedule():
    """Get approved consultations for physician calendar"""
    try:
        current_user = g.current_user
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        start_date = None
        end_date = None
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        
        consultations = Consultation.get_approved_for_physician(
            physician._id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Populate patient data
        result = []
        for consultation in consultations:
            consultation_data = consultation.to_safe_dict()
            patient = User.find_by_id(str(consultation.patient_id))
            if patient:
                consultation_data['patient'] = patient.to_safe_dict()
            result.append(consultation_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting physician schedule: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get schedule'
        }), 500
