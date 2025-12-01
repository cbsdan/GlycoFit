from flask import request, jsonify, g
from models.appointment import Appointment
from models.physician import Physician
from models.user import User
from models.patient_physician import PatientPhysician
from bson import ObjectId
from datetime import datetime, timedelta
import logging

def create_patient_appointment():
    """Patient creates a new appointment"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json()
        
        # Validate required fields
        required_fields = ['physician_id', 'appointment_date']
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
        
        # Create appointment
        appointment_date = datetime.fromisoformat(data['appointment_date'].replace('Z', '+00:00'))
        
        appointment = Appointment(
            physician_id=physician._id,
            patient_id=current_user._id,
            appointment_date=appointment_date,
            duration_minutes=data.get('duration_minutes', 30),
            appointment_type=data.get('appointment_type', 'Follow-up')
        )
        
        appointment.reason = data.get('reason', '')
        appointment.notes = data.get('notes', '')
        appointment.status = 'pending'  # Patient-created appointments start as pending
        
        appointment.save()
        
        logging.info(f"Patient {current_user._id} created appointment with physician {physician._id}")
        
        return jsonify({
            'success': True,
            'message': 'Appointment request sent successfully',
            'data': appointment.to_safe_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating patient appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create appointment'
        }), 500

def get_patient_appointments():
    """Get patient's appointments"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        status = request.args.get('status')  # pending, confirmed, cancelled, completed
        physician_id = request.args.get('physician_id')
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        # Get appointments
        appointments = Appointment.get_patient_appointments(
            current_user._id,
            status=status,
            skip=0,
            limit=100
        )
        
        # Filter by physician if specified
        if physician_id:
            appointments = [apt for apt in appointments if str(apt.physician_id) == physician_id]
        
        # Filter by date range if specified
        if start_date_str or end_date_str:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')) if start_date_str else None
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')) if end_date_str else None
            
            filtered = []
            for apt in appointments:
                if start_date and apt.appointment_date < start_date:
                    continue
                if end_date and apt.appointment_date > end_date:
                    continue
                filtered.append(apt)
            appointments = filtered
        
        # Populate physician data
        result = []
        for appointment in appointments:
            appointment_data = appointment.to_safe_dict()
            
            # Get physician and user data
            physician = Physician.find_by_id(str(appointment.physician_id))
            if physician:
                physician_user = User.find_by_id(str(physician.user_id))
                if physician_user:
                    appointment_data['physician'] = {
                        **physician.to_safe_dict(),
                        'user': {
                            'first_name': physician_user.first_name,
                            'last_name': physician_user.last_name,
                            'email': physician_user.email,
                            'avatar': physician_user.avatar
                        }
                    }
            
            result.append(appointment_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting patient appointments: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get appointments'
        }), 500

def get_patient_appointment(appointment_id):
    """Get specific appointment"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({'success': False, 'message': 'Appointment not found'}), 404
        
        # Verify ownership
        if str(appointment.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        appointment_data = appointment.to_safe_dict()
        
        # Populate physician data
        physician = Physician.find_by_id(str(appointment.physician_id))
        if physician:
            physician_user = User.find_by_id(str(physician.user_id))
            if physician_user:
                appointment_data['physician'] = {
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
            'data': appointment_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get appointment'
        }), 500

def cancel_patient_appointment(appointment_id):
    """Patient cancels an appointment"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json() or {}
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({'success': False, 'message': 'Appointment not found'}), 404
        
        # Verify ownership
        if str(appointment.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        # Can only cancel pending or confirmed appointments
        if appointment.status not in ['pending', 'confirmed']:
            return jsonify({
                'success': False,
                'message': f'Cannot cancel appointment with status: {appointment.status}'
            }), 400
        
        appointment.cancel(data.get('reason', 'Cancelled by patient'))
        appointment.save()
        
        logging.info(f"Patient {current_user._id} cancelled appointment {appointment_id}")
        
        return jsonify({
            'success': True,
            'message': 'Appointment cancelled successfully',
            'data': appointment.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error cancelling appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to cancel appointment'
        }), 500

def reschedule_patient_appointment(appointment_id):
    """Patient reschedules an appointment"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json()
        
        if 'appointment_date' not in data:
            return jsonify({
                'success': False,
                'message': 'appointment_date is required'
            }), 400
        
        appointment = Appointment.find_by_id(appointment_id)
        
        if not appointment:
            return jsonify({'success': False, 'message': 'Appointment not found'}), 404
        
        # Verify ownership
        if str(appointment.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        # Can only reschedule pending or confirmed appointments
        if appointment.status not in ['pending', 'confirmed']:
            return jsonify({
                'success': False,
                'message': f'Cannot reschedule appointment with status: {appointment.status}'
            }), 400
        
        new_date = datetime.fromisoformat(data['appointment_date'].replace('Z', '+00:00'))
        appointment.reschedule(new_date, data.get('duration_minutes'))
        
        # Reset to pending if it was confirmed (requires physician re-confirmation)
        if appointment.status == 'confirmed':
            appointment.status = 'pending'
        
        appointment.save()
        
        logging.info(f"Patient {current_user._id} rescheduled appointment {appointment_id}")
        
        return jsonify({
            'success': True,
            'message': 'Appointment rescheduled successfully',
            'data': appointment.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error rescheduling appointment: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to reschedule appointment'
        }), 500
