from flask import jsonify, request, g
from models.patient_physician import PatientPhysician
from models.physician import Physician
from models.user import User
from bson import ObjectId
import logging

def get_available_physicians():
    """Get all active physicians that patient can request"""
    try:
        user = g.current_user
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        # user is already a User object from middleware
        # No need to fetch again, just use it directly
        user_obj = user

        # Get all active physicians
        physicians = Physician.get_all_physicians(active_only=True, limit=100)
        
        # Get user's existing requests/relationships
        existing_relationships = PatientPhysician.get_patient_physicians(user_obj._id)
        existing_physician_ids = [str(rel.physician_id) for rel in existing_relationships]

        # Build response with physician and user data
        physician_list = []
        for physician in physicians:
            # Get user data for this physician
            physician_user = User.find_by_id(physician.user_id)
            if not physician_user:
                continue

            # Check if patient already has relationship with this physician
            relationship_status = None
            for rel in existing_relationships:
                if str(rel.physician_id) == str(physician._id):
                    relationship_status = rel.status
                    break

            # Count only active (non-rejected, non-duplicate) patient relationships
            active_patient_count = len(PatientPhysician.get_physician_patients(physician._id, status='active'))

            physician_data = {
                **physician.to_safe_dict(),
                'total_patients': active_patient_count,
                'user': {
                    'first_name': physician_user.first_name,
                    'last_name': physician_user.last_name,
                    'email': physician_user.email,
                    'avatar': physician_user.avatar
                },
                'relationship_status': relationship_status
            }
            physician_list.append(physician_data)

        return jsonify({
            'success': True,
            'data': physician_list,
            'total': len(physician_list)
        }), 200

    except Exception as e:
        logging.error(f"Error getting available physicians: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


def send_physician_request():
    """Send request to a physician"""
    try:
        user = g.current_user
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        data = request.get_json()
        physician_id = data.get('physician_id')
        reason = data.get('reason', '')
        urgency = data.get('urgency', 'low')

        if not physician_id:
            return jsonify({'success': False, 'error': 'Physician ID is required'}), 400

        # user is already a User object from middleware
        user_obj = user

        # Verify physician exists and is active
        physician = Physician.find_by_id(physician_id)
        if not physician:
            return jsonify({'success': False, 'error': 'Physician not found'}), 404
        
        if not physician.is_active:
            return jsonify({'success': False, 'error': 'Physician is not currently available'}), 400

        # Check if relationship already exists
        existing = PatientPhysician.find_by_patient_and_physician(user_obj._id, physician._id)
        if existing:
            if existing.status == 'pending':
                return jsonify({'success': False, 'error': 'Request already pending'}), 400
            elif existing.status == 'active':
                return jsonify({'success': False, 'error': 'Already connected to this physician'}), 400
            elif existing.status == 'declined':
                # Allow re-requesting after decline
                existing.status = 'pending'
                existing.reason = reason
                existing.urgency = urgency
                existing.request_date = existing.updated_at
                existing.save()
                return jsonify({
                    'success': True,
                    'message': 'Request sent successfully',
                    'data': existing.to_safe_dict()
                }), 200

        # Create new relationship
        relationship = PatientPhysician(
            patient_id=user_obj._id,
            physician_id=physician._id,
            status='pending'
        )
        relationship.reason = reason
        relationship.urgency = urgency
        relationship.save()

        logging.info(f"Patient {user_obj._id} sent request to physician {physician._id}")

        return jsonify({
            'success': True,
            'message': 'Request sent successfully',
            'data': relationship.to_safe_dict()
        }), 201

    except Exception as e:
        logging.error(f"Error sending physician request: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


def get_my_physician():
    """Get patient's current physician(s)"""
    try:
        user = g.current_user
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        # user is already a User object from middleware
        user_obj = user

        # Get all relationships (active and pending)
        relationships = PatientPhysician.get_patient_physicians(user_obj._id)
        
        result = []
        for rel in relationships:
            # Get physician data
            physician = Physician.find_by_id(rel.physician_id)
            if not physician:
                continue

            # Get physician user data
            physician_user = User.find_by_id(physician.user_id)
            if not physician_user:
                continue

            relationship_data = {
                'relationship': rel.to_safe_dict(),
                'physician': {
                    **physician.to_safe_dict(),
                    'user': {
                        'first_name': physician_user.first_name,
                        'last_name': physician_user.last_name,
                        'email': physician_user.email,
                        'avatar': physician_user.avatar
                    }
                }
            }
            result.append(relationship_data)

        return jsonify({
            'success': True,
            'data': result,
            'total': len(result)
        }), 200

    except Exception as e:
        logging.error(f"Error getting patient physicians: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


def cancel_physician_request(request_id):
    """Cancel a pending physician request"""
    try:
        user = g.current_user
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        # user is already a User object from middleware
        user_obj = user

        # Get relationship
        relationship = PatientPhysician.find_by_id(request_id)
        if not relationship:
            return jsonify({'success': False, 'error': 'Request not found'}), 404

        # Verify ownership
        if str(relationship.patient_id) != str(user_obj._id):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        # Can only cancel pending requests
        if relationship.status != 'pending':
            return jsonify({'success': False, 'error': 'Can only cancel pending requests'}), 400

        # Delete the relationship
        from config.database import get_db
        db = get_db()
        db.patient_physicians.delete_one({'_id': relationship._id})

        logging.info(f"Patient {user_obj._id} cancelled request {request_id}")

        return jsonify({
            'success': True,
            'message': 'Request cancelled successfully'
        }), 200

    except Exception as e:
        logging.error(f"Error cancelling physician request: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


def disconnect_physician(relationship_id):
    """Disconnect from a physician"""
    try:
        user = g.current_user
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        # user is already a User object from middleware
        user_obj = user

        # Get relationship
        relationship = PatientPhysician.find_by_id(relationship_id)
        if not relationship:
            return jsonify({'success': False, 'error': 'Relationship not found'}), 404

        # Verify ownership
        if str(relationship.patient_id) != str(user_obj._id):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        # Can only disconnect active relationships
        if relationship.status != 'active':
            return jsonify({'success': False, 'error': 'Can only disconnect active relationships'}), 400

        # Deactivate relationship
        relationship.deactivate("Disconnected by patient")
        relationship.save()

        logging.info(f"Patient {user_obj._id} disconnected from physician")

        return jsonify({
            'success': True,
            'message': 'Disconnected from physician successfully'
        }), 200

    except Exception as e:
        logging.error(f"Error disconnecting from physician: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
