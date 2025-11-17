from flask import request, jsonify, g
from models.physician import Physician
from models.prescription import Prescription
from models.user import User
from bson import ObjectId
from datetime import datetime
import logging

def create_prescription():
    """Create a new prescription"""
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
        required_fields = ['patient_id', 'medication_name', 'dosage', 'frequency']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        # Create prescription
        prescription = Prescription(
            physician_id=physician._id,
            patient_id=ObjectId(data['patient_id']),
            medication_name=data['medication_name'],
            dosage=data['dosage'],
            frequency=data['frequency']
        )
        
        # Set optional fields
        prescription.duration_days = data.get('duration_days')
        prescription.quantity = data.get('quantity')
        prescription.refills_allowed = data.get('refills_allowed', 0)
        prescription.refills_remaining = data.get('refills_allowed', 0)
        prescription.instructions = data.get('instructions', '')
        prescription.side_effects_warning = data.get('side_effects_warning', '')
        prescription.consultation_id = ObjectId(data['consultation_id']) if data.get('consultation_id') else None
        
        if data.get('start_date'):
            prescription.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        if data.get('end_date'):
            prescription.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        prescription.save()
        
        return jsonify({
            'success': True,
            'message': 'Prescription created successfully',
            'data': prescription.to_safe_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating prescription: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create prescription'
        }), 500

def get_prescriptions():
    """Get prescriptions for physician"""
    try:
        current_user = g.current_user
        status = request.args.get('status')  # active, completed, cancelled, expired
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
        
        prescriptions = Prescription.get_physician_prescriptions(physician._id, status=status)
        
        # Filter by patient_id if provided
        if patient_id_str:
            prescriptions = [p for p in prescriptions if str(p.patient_id) == patient_id_str]
        
        # Populate patient data
        result = []
        for prescription in prescriptions:
            prescription_data = prescription.to_safe_dict()
            patient = User.find_by_id(str(prescription.patient_id))
            if patient:
                prescription_data['patient'] = patient.to_safe_dict()
            result.append(prescription_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting prescriptions: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get prescriptions'
        }), 500

def get_prescription(prescription_id):
    """Get specific prescription"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        prescription = Prescription.find_by_id(prescription_id)
        
        if not prescription:
            return jsonify({
                'success': False,
                'message': 'Prescription not found'
            }), 404
        
        # Verify physician owns this prescription
        if str(prescription.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        prescription_data = prescription.to_safe_dict()
        patient = User.find_by_id(str(prescription.patient_id))
        if patient:
            prescription_data['patient'] = patient.to_safe_dict()
        
        return jsonify({
            'success': True,
            'data': prescription_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting prescription: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get prescription'
        }), 500

def update_prescription(prescription_id):
    """Update a prescription"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        prescription = Prescription.find_by_id(prescription_id)
        
        if not prescription:
            return jsonify({
                'success': False,
                'message': 'Prescription not found'
            }), 404
        
        if str(prescription.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Update allowed fields
        allowed_fields = ['medication_name', 'dosage', 'frequency', 'duration_days', 
                         'quantity', 'refills_allowed', 'instructions', 'side_effects_warning', 
                         'pharmacy_notes']
        
        for field in allowed_fields:
            if field in data:
                setattr(prescription, field, data[field])
        
        if 'start_date' in data:
            prescription.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        if 'end_date' in data:
            prescription.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        prescription.save()
        
        return jsonify({
            'success': True,
            'message': 'Prescription updated successfully',
            'data': prescription.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error updating prescription: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to update prescription'
        }), 500

def refill_prescription(prescription_id):
    """Process a refill for a prescription"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        prescription = Prescription.find_by_id(prescription_id)
        
        if not prescription:
            return jsonify({
                'success': False,
                'message': 'Prescription not found'
            }), 404
        
        if str(prescription.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        if prescription.refill():
            prescription.save()
            return jsonify({
                'success': True,
                'message': 'Prescription refilled successfully',
                'data': prescription.to_safe_dict()
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'No refills remaining'
            }), 400
        
    except Exception as e:
        logging.error(f"Error refilling prescription: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to refill prescription'
        }), 500

def cancel_prescription(prescription_id):
    """Cancel a prescription"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        prescription = Prescription.find_by_id(prescription_id)
        
        if not prescription:
            return jsonify({
                'success': False,
                'message': 'Prescription not found'
            }), 404
        
        if str(prescription.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        prescription.cancel(data.get('reason', ''))
        prescription.save()
        
        return jsonify({
            'success': True,
            'message': 'Prescription cancelled',
            'data': prescription.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error cancelling prescription: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to cancel prescription'
        }), 500
