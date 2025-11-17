from flask import request, jsonify, g
from models.physician import Physician
from models.appointment import Appointment
from models.user import User
from bson import ObjectId
from datetime import datetime, timedelta
import logging

def create_appointment():
    """Create a new appointment"""
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
        required_fields = ['patient_id', 'appointment_date']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        # Create appointment
        appointment_date = datetime.fromisoformat(data['appointment_date'].replace('Z', '+00:00'))
        
        appointment = Appointment(
            physician_id=physician._id,
            patient_id=ObjectId(data['patient_id']),
            appointment_date=appointment_date,
            duration_minutes=data.get('duration_minutes', 30),
            appointment_type=data.get('appointment_type', 'Follow-up')
        )
        
        appointment.reason = data.get('reason', '')
        appointment.notes = data.get('notes', '')
        appointment.status = data.get('status', 'pending')
        
        appointment.save()
        
        return jsonify({
            'success': True,
            'message': 'Appointment created successfully',
            'data': appointment.to_safe_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create appointment'
        }), 500

def get_appointments():
    """Get appointments for physician"""
    try:
        current_user = g.current_user
        status = request.args.get('status')  # pending, confirmed, cancelled, completed
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        date_str = request.args.get('date')  # Specific date
        
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
        
        # If specific date provided, set start and end to that day
        if date_str:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = start_date + timedelta(days=1)
        elif start_date_str:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            if end_date_str:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        
        appointments = Appointment.get_physician_appointments(
            physician._id,
            start_date=start_date,
            end_date=end_date,
            status=status
        )
        
        # Populate patient data
        result = []
        for appointment in appointments:
            appointment_data = appointment.to_safe_dict()
            patient = User.find_by_id(str(appointment.patient_id))
            if patient:
                appointment_data['patient'] = patient.to_safe_dict()
            result.append(appointment_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting appointments: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get appointments'
        }), 500

def get_appointment(appointment_id):
    """Get specific appointment"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({
                'success': False,
                'message': 'Appointment not found'
            }), 404
        
        # Verify physician owns this appointment
        if str(appointment.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        appointment_data = appointment.to_safe_dict()
        patient = User.find_by_id(str(appointment.patient_id))
        if patient:
            appointment_data['patient'] = patient.to_safe_dict()
        
        return jsonify({
            'success': True,
            'data': appointment_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get appointment'
        }), 500

def confirm_appointment(appointment_id):
    """Confirm an appointment"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({
                'success': False,
                'message': 'Appointment not found'
            }), 404
        
        if str(appointment.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        appointment.confirm()
        appointment.save()
        
        return jsonify({
            'success': True,
            'message': 'Appointment confirmed',
            'data': appointment.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error confirming appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to confirm appointment'
        }), 500

def cancel_appointment(appointment_id):
    """Cancel an appointment"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({
                'success': False,
                'message': 'Appointment not found'
            }), 404
        
        if str(appointment.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        appointment.cancel(data.get('reason', ''))
        appointment.save()
        
        return jsonify({
            'success': True,
            'message': 'Appointment cancelled',
            'data': appointment.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error cancelling appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to cancel appointment'
        }), 500

def reschedule_appointment(appointment_id):
    """Reschedule an appointment"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        if 'appointment_date' not in data:
            return jsonify({
                'success': False,
                'message': 'appointment_date is required'
            }), 400
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({
                'success': False,
                'message': 'Appointment not found'
            }), 404
        
        if str(appointment.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        new_date = datetime.fromisoformat(data['appointment_date'].replace('Z', '+00:00'))
        appointment.reschedule(new_date, data.get('duration_minutes'))
        appointment.save()
        
        return jsonify({
            'success': True,
            'message': 'Appointment rescheduled',
            'data': appointment.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error rescheduling appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to reschedule appointment'
        }), 500

def complete_appointment(appointment_id):
    """Complete an appointment"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({
                'success': False,
                'message': 'Appointment not found'
            }), 404
        
        if str(appointment.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        consultation_id = ObjectId(data['consultation_id']) if data.get('consultation_id') else None
        appointment.complete(data.get('notes', ''), consultation_id)
        appointment.save()
        
        return jsonify({
            'success': True,
            'message': 'Appointment completed',
            'data': appointment.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error completing appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to complete appointment'
        }), 500
