from flask import request, jsonify, g
from models.prescription import Prescription
from models.physician import Physician
from models.user import User
from models.patient_physician import PatientPhysician
from bson import ObjectId
import logging

def get_patient_prescriptions():
    """Get patient's prescriptions"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        status = request.args.get('status')  # active, completed, cancelled, expired
        physician_id = request.args.get('physician_id')
        
        # Get prescriptions
        prescriptions = Prescription.get_patient_prescriptions(
            current_user._id,
            status=status,
            skip=0,
            limit=100
        )
        
        # Filter by physician if specified
        if physician_id:
            prescriptions = [rx for rx in prescriptions if str(rx.physician_id) == physician_id]
        
        # Populate physician data
        result = []
        for prescription in prescriptions:
            prescription_data = prescription.to_safe_dict()
            
            # Get physician and user data
            physician = Physician.find_by_id(str(prescription.physician_id))
            if physician:
                physician_user = User.find_by_id(str(physician.user_id))
                if physician_user:
                    prescription_data['physician'] = {
                        **physician.to_safe_dict(),
                        'user': {
                            'first_name': physician_user.first_name,
                            'last_name': physician_user.last_name,
                            'email': physician_user.email,
                            'avatar': physician_user.avatar
                        }
                    }
            
            result.append(prescription_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting patient prescriptions: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get prescriptions'
        }), 500

def get_patient_prescription(prescription_id):
    """Get specific prescription"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        prescription = Prescription.find_by_id(prescription_id)
        
        if not prescription:
            return jsonify({'success': False, 'message': 'Prescription not found'}), 404
        
        # Verify ownership
        if str(prescription.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        prescription_data = prescription.to_safe_dict()
        
        # Populate physician data
        physician = Physician.find_by_id(str(prescription.physician_id))
        if physician:
            physician_user = User.find_by_id(str(physician.user_id))
            if physician_user:
                prescription_data['physician'] = {
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
            'data': prescription_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting prescription: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get prescription'
        }), 500

def request_prescription_refill(prescription_id):
    """Patient requests a prescription refill"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        prescription = Prescription.find_by_id(prescription_id)
        
        if not prescription:
            return jsonify({'success': False, 'message': 'Prescription not found'}), 404
        
        # Verify ownership
        if str(prescription.patient_id) != str(current_user._id):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
        # Check if prescription is active
        if prescription.status != 'active':
            return jsonify({
                'success': False,
                'message': f'Cannot refill prescription with status: {prescription.status}'
            }), 400
        
        # Check if refills are available
        if prescription.refills_remaining <= 0:
            return jsonify({
                'success': False,
                'message': 'No refills remaining. Please contact your physician.'
            }), 400
        
        # Process refill (this decrements refills_remaining)
        if prescription.refill():
            prescription.save()
            
            logging.info(f"Patient {current_user._id} requested refill for prescription {prescription_id}")
            
            return jsonify({
                'success': True,
                'message': 'Refill request processed successfully',
                'data': prescription.to_safe_dict()
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Refill request failed'
            }), 400
        
    except Exception as e:
        logging.error(f"Error requesting prescription refill: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to request refill'
        }), 500
