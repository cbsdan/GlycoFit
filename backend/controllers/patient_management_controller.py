from flask import request, jsonify, g
from models.user import User
from models.physician import Physician
from models.patient_physician import PatientPhysician
from bson import ObjectId
from datetime import datetime
import logging

def get_patient_requests():
    """Get pending patient requests for current physician"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        # Get pending requests
        requests = PatientPhysician.get_physician_patients(physician._id, status='pending')
        
        # Populate patient data
        result = []
        for req in requests:
            patient = User.find_by_id(str(req.patient_id))
            if patient:
                request_data = req.to_safe_dict()
                request_data['patient'] = patient.to_safe_dict()
                result.append(request_data)
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting patient requests: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get patient requests'
        }), 500

def accept_patient_request(request_id):
    """Accept a patient request"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        # Get the request
        patient_physician = PatientPhysician.find_by_id(request_id)
        
        if not patient_physician:
            return jsonify({
                'success': False,
                'message': 'Request not found'
            }), 404
        
        # Verify it belongs to this physician
        if str(patient_physician.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Accept the request
        notes = data.get('notes', '')
        patient_physician.accept(notes)
        patient_physician.save()
        
        # Update physician stats
        physician.total_patients += 1
        physician.save()
        
        return jsonify({
            'success': True,
            'message': 'Patient request accepted',
            'data': patient_physician.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error accepting patient request: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to accept patient request'
        }), 500

def decline_patient_request(request_id):
    """Decline a patient request"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
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
        
        # Get the request
        patient_physician = PatientPhysician.find_by_id(request_id)
        
        if not patient_physician:
            return jsonify({
                'success': False,
                'message': 'Request not found'
            }), 404
        
        # Verify it belongs to this physician
        if str(patient_physician.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Decline the request
        notes = data.get('notes', '')
        patient_physician.decline(notes)
        patient_physician.save()
        
        return jsonify({
            'success': True,
            'message': 'Patient request declined',
            'data': patient_physician.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error declining patient request: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to decline patient request'
        }), 500

def get_physician_patients():
    """Get all patients for current physician"""
    try:
        current_user = g.current_user
        status = request.args.get('status', 'active')  # active, pending, all
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        # Get patients based on status filter
        if status == 'all':
            relationships = PatientPhysician.get_physician_patients(physician._id)
        else:
            relationships = PatientPhysician.get_physician_patients(physician._id, status=status)
        
        # Populate patient data
        result = []
        for rel in relationships:
            patient = User.find_by_id(str(rel.patient_id))
            if patient:
                patient_data = patient.to_safe_dict()
                patient_data['relationship'] = rel.to_safe_dict()
                
                # TODO: Add health data like glucose levels, medications count, last visit
                patient_data['health_info'] = {
                    'glucose_level': 120,  # Placeholder - should come from health records
                    'medications': 2,  # Placeholder - should count from prescriptions
                    'last_visit': rel.acceptance_date.isoformat() if rel.acceptance_date else None
                }
                
                result.append(patient_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting physician patients: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get patients'
        }), 500

def get_patient_details(patient_id):
    """Get details of a specific patient"""
    try:
        current_user = g.current_user
        
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
        
        # Verify relationship exists
        relationship = PatientPhysician.find_by_patient_and_physician(patient_id, physician._id)
        
        if not relationship or relationship.status not in ['active', 'pending']:
            return jsonify({
                'success': False,
                'message': 'Patient not found or not associated with this physician'
            }), 404
        
        # Get patient data
        patient = User.find_by_id(patient_id)
        if not patient:
            return jsonify({
                'success': False,
                'message': 'Patient not found'
            }), 404
        
        patient_data = patient.to_safe_dict()
        patient_data['relationship'] = relationship.to_safe_dict()
        
        # TODO: Add comprehensive health data
        patient_data['health_info'] = {
            'glucose_level': 120,
            'medications': 2,
            'last_visit': relationship.acceptance_date.isoformat() if relationship.acceptance_date else None,
            'condition': 'Type 2 Diabetes'  # Should come from health records
        }
        
        return jsonify({
            'success': True,
            'data': patient_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting patient details: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get patient details'
        }), 500
