"""
SOAP Note Controller
Handles creating quick vitals logs and full SOAP consultation notes
for the physician app's patient detail Consultations tab.
"""
from flask import request, jsonify, g
from models.physician import Physician
from models.consultation import Consultation
from models.user import User
from bson import ObjectId
from datetime import datetime
import logging


def _get_physician():
    """Helper to get or create physician profile for the current user."""
    current_user = g.current_user
    physician = Physician.find_by_user_id(current_user._id)
    if not physician:
        physician = Physician(
            user_id=current_user._id,
            specialization='General Practice',
            license_number='',
            years_of_experience=0
        )
        physician.save()
    return physician


def create_soap_note():
    """
    Create a SOAP consultation note or quick vitals log for a patient.
    
    Body JSON:
      - patient_id (required)
      - consultation_mode: 'quick_vitals' | 'full'  (default: 'full')
      
        Quick Vitals fields (consultation_mode == 'quick_vitals'):
            - ogtt (Oral Glucose Tolerance Test)
            - fasting_blood_sugar
            - hba1c
      
        Full SOAP fields (consultation_mode == 'full'):
            - subjective: text
            - objective: { physical_exam_findings }
      - assessment: text
      - plan: text
      - prescriptions: [{ medication, dosage, frequency, duration, notes }]
      - follow_up_required: bool
    """
    try:
        physician = _get_physician()
        data = request.get_json()

        if not data or 'patient_id' not in data:
            return jsonify({'success': False, 'message': 'patient_id is required'}), 400

        patient_id = data['patient_id']
        mode = data.get('consultation_mode', 'full')

        # Validate patient exists
        patient = User.find_by_id(patient_id)
        if not patient:
            return jsonify({'success': False, 'message': 'Patient not found'}), 404

        # Create consultation record
        consultation = Consultation(
            physician_id=physician._id,
            patient_id=ObjectId(patient_id),
            consultation_type='in-person',
            scheduled_date=datetime.utcnow(),
            duration_minutes=0
        )
        consultation.consultation_mode = mode
        consultation.status = Consultation.STATUS_COMPLETED
        consultation.actual_start_time = datetime.utcnow()
        consultation.actual_end_time = datetime.utcnow()

        if mode == 'quick_vitals':
            consultation.soap_objective = {
                'ogtt': data.get('ogtt'),
                'fasting_blood_sugar': data.get('fasting_blood_sugar'),
                'hba1c': data.get('hba1c'),
            }
            consultation.soap_subjective = ''
            consultation.soap_assessment = ''
            consultation.soap_plan = ''
            consultation.soap_prescriptions = []
        else:
            # Full SOAP (objective no longer includes glucose labs)
            objective = data.get('objective', {})
            consultation.soap_subjective = data.get('subjective', '')
            consultation.soap_objective = {
                'physical_exam_findings': objective.get('physical_exam_findings', ''),
            }
            consultation.soap_assessment = data.get('assessment', '')
            consultation.soap_plan = data.get('plan', '')
            consultation.soap_prescriptions = data.get('prescriptions', [])
            consultation.follow_up_required = data.get('follow_up_required', False)
            # Map to legacy fields too for backward compat
            consultation.diagnosis = data.get('assessment', '')
            consultation.treatment_plan = data.get('plan', '')
            consultation.notes = data.get('subjective', '')

        consultation.save()

        # Update physician stats
        physician.total_consultations = getattr(physician, 'total_consultations', 0) + 1
        physician.save()

        return jsonify({
            'success': True,
            'message': 'SOAP note created successfully' if mode == 'full' else 'Quick vitals logged successfully',
            'data': consultation.to_safe_dict()
        }), 201

    except Exception as e:
        logging.error(f"Error creating SOAP note: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to create note'}), 500


def update_soap_note(note_id):
    """
    Update an existing SOAP note / quick vitals log.
    Sets a new updated_at timestamp.
    Accepts the same body fields as create_soap_note (except patient_id).
    """
    try:
        physician = _get_physician()
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        from config.database import get_db
        db = get_db()

        note = db.consultations.find_one({
            '_id': ObjectId(note_id),
            'physician_id': physician._id,
        })
        if not note:
            return jsonify({'success': False, 'message': 'Note not found'}), 404

        mode = note.get('consultation_mode', 'full')
        update_fields = {'updated_at': datetime.utcnow()}

        if mode == 'quick_vitals':
            if 'ogtt' in data:
                update_fields.setdefault('soap_objective', note.get('soap_objective', {}))
                update_fields['soap_objective']['ogtt'] = data['ogtt']
            if 'fasting_blood_sugar' in data:
                update_fields.setdefault('soap_objective', note.get('soap_objective', {}))
                update_fields['soap_objective']['fasting_blood_sugar'] = data['fasting_blood_sugar']
            if 'hba1c' in data:
                update_fields.setdefault('soap_objective', note.get('soap_objective', {}))
                update_fields['soap_objective']['hba1c'] = data['hba1c']
        else:
            if 'subjective' in data:
                update_fields['soap_subjective'] = data['subjective']
                update_fields['notes'] = data['subjective']
            if 'objective' in data:
                obj = data['objective']
                update_fields['soap_objective'] = {
                    'physical_exam_findings': obj.get('physical_exam_findings', ''),
                }
            if 'assessment' in data:
                update_fields['soap_assessment'] = data['assessment']
                update_fields['diagnosis'] = data['assessment']
            if 'plan' in data:
                update_fields['soap_plan'] = data['plan']
                update_fields['treatment_plan'] = data['plan']
            if 'prescriptions' in data:
                update_fields['soap_prescriptions'] = data['prescriptions']
            if 'follow_up_required' in data:
                update_fields['follow_up_required'] = data['follow_up_required']

        db.consultations.update_one({'_id': ObjectId(note_id)}, {'$set': update_fields})

        updated = db.consultations.find_one({'_id': ObjectId(note_id)})
        consultation = Consultation.from_dict(updated)
        consultation._id = updated['_id']

        return jsonify({
            'success': True,
            'message': 'Note updated successfully',
            'data': consultation.to_safe_dict()
        }), 200

    except Exception as e:
        logging.error(f"Error updating SOAP note: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update note'}), 500


def delete_soap_note(note_id):
    """
    Delete a SOAP note / quick vitals log.
    Only the physician who created it can delete it.
    """
    try:
        physician = _get_physician()

        from config.database import get_db
        db = get_db()

        result = db.consultations.delete_one({
            '_id': ObjectId(note_id),
            'physician_id': physician._id,
        })

        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Note not found'}), 404

        return jsonify({
            'success': True,
            'message': 'Note deleted successfully'
        }), 200

    except Exception as e:
        logging.error(f"Error deleting SOAP note: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete note'}), 500


def get_patient_soap_notes(patient_id):
    """
    Get all SOAP consultation notes for a specific patient (physician scoped).
    Returns notes sorted by date descending.
    """
    try:
        physician = _get_physician()

        from config.database import get_db
        db = get_db()

        query = {
            'physician_id': physician._id,
            'patient_id': ObjectId(patient_id),
            'consultation_mode': {'$in': ['quick_vitals', 'full']}
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
