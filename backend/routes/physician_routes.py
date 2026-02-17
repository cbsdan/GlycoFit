from flask import Blueprint
from controllers.physician_controller import (
    get_physician_profile,
    update_physician_profile,
    update_availability,
    get_physician_stats,
    save_physician_fcm_token,
    delete_physician_fcm_token
)
from controllers.patient_management_controller import (
    get_patient_requests,
    accept_patient_request,
    decline_patient_request,
    get_physician_patients,
    get_patient_details
)
from controllers.consultation_controller import (
    create_consultation,
    get_consultations,
    get_consultation,
    start_consultation,
    complete_consultation,
    cancel_consultation,
    reschedule_consultation,
    get_pending_consultation_requests,
    approve_consultation,
    reject_consultation,
    get_physician_schedule
)
from controllers.prescription_controller import (
    create_prescription,
    get_prescriptions,
    get_prescription,
    update_prescription,
    refill_prescription,
    cancel_prescription
)
from controllers.appointment_controller import (
    create_appointment,
    get_appointments,
    get_appointment,
    confirm_appointment,
    cancel_appointment as cancel_appointment_controller,
    reschedule_appointment,
    complete_appointment
)
from controllers.availability_controller import (
    create_availability,
    get_availability,
    update_availability as update_availability_schedule,
    delete_availability
)
from controllers.soap_note_controller import (
    create_soap_note,
    get_patient_soap_notes,
    update_soap_note,
    delete_soap_note
)
from middleware.firebase_auth import firebase_auth_required
from flask import g

physician_bp = Blueprint('physician', __name__)

@physician_bp.before_request
@firebase_auth_required
def before_physician_request():
    """Set up g.current_user for all physician routes"""
    from flask import request
    g.current_user = getattr(request, 'current_user', None)

# ============================================
# PHYSICIAN PROFILE ROUTES
# ============================================
@physician_bp.route('/profile', methods=['GET'])
def profile_get():
    """Get physician profile"""
    return get_physician_profile()

@physician_bp.route('/profile', methods=['PUT'])
def profile_update():
    """Update physician profile"""
    return update_physician_profile()

@physician_bp.route('/availability', methods=['PUT'])
def availability_update():
    """Update physician availability"""
    return update_availability()

@physician_bp.route('/stats', methods=['GET'])
def stats_get():
    """Get physician statistics"""
    return get_physician_stats()

@physician_bp.route('/profile/picture', methods=['POST'])
def profile_picture_upload():
    """Upload profile picture"""
    from controllers.physician_controller import upload_profile_picture
    return upload_profile_picture()

# ============================================
# PATIENT MANAGEMENT ROUTES
# ============================================
@physician_bp.route('/patients/requests', methods=['GET'])
def patient_requests_get():
    """Get patient requests"""
    return get_patient_requests()

@physician_bp.route('/patients/requests/<request_id>/accept', methods=['POST'])
def patient_request_accept(request_id):
    """Accept patient request"""
    return accept_patient_request(request_id)

@physician_bp.route('/patients/requests/<request_id>/decline', methods=['POST'])
def patient_request_decline(request_id):
    """Decline patient request"""
    return decline_patient_request(request_id)

@physician_bp.route('/patients', methods=['GET'])
def patients_get():
    """Get physician's patients"""
    return get_physician_patients()

@physician_bp.route('/patients/<patient_id>', methods=['GET'])
def patient_details_get(patient_id):
    """Get patient details"""
    return get_patient_details(patient_id)

# ============================================
# CONSULTATION ROUTES
# ============================================
@physician_bp.route('/consultations', methods=['POST'])
def consultation_create():
    """Create new consultation"""
    return create_consultation()

@physician_bp.route('/consultations', methods=['GET'])
def consultations_get():
    """Get consultations"""
    return get_consultations()

@physician_bp.route('/consultations/pending', methods=['GET'])
def consultations_pending_get():
    """Get pending consultation requests"""
    return get_pending_consultation_requests()

@physician_bp.route('/consultations/schedule', methods=['GET'])
def consultations_schedule_get():
    """Get approved consultations for calendar/schedule view"""
    return get_physician_schedule()

@physician_bp.route('/consultations/<consultation_id>', methods=['GET'])
def consultation_get(consultation_id):
    """Get specific consultation"""
    return get_consultation(consultation_id)

@physician_bp.route('/consultations/<consultation_id>/approve', methods=['POST'])
def consultation_approve(consultation_id):
    """Approve consultation request with meeting details"""
    return approve_consultation(consultation_id)

@physician_bp.route('/consultations/<consultation_id>/reject', methods=['POST'])
def consultation_reject(consultation_id):
    """Reject consultation request"""
    return reject_consultation(consultation_id)

@physician_bp.route('/consultations/<consultation_id>/start', methods=['POST'])
def consultation_start(consultation_id):
    """Start consultation"""
    return start_consultation(consultation_id)

@physician_bp.route('/consultations/<consultation_id>/complete', methods=['POST'])
def consultation_complete(consultation_id):
    """Complete consultation"""
    return complete_consultation(consultation_id)

@physician_bp.route('/consultations/<consultation_id>/cancel', methods=['POST'])
def consultation_cancel(consultation_id):
    """Cancel consultation"""
    return cancel_consultation(consultation_id)

@physician_bp.route('/consultations/<consultation_id>/reschedule', methods=['POST'])
def consultation_reschedule(consultation_id):
    """Reschedule consultation"""
    return reschedule_consultation(consultation_id)

# ============================================
# PRESCRIPTION ROUTES
# ============================================
@physician_bp.route('/prescriptions', methods=['POST'])
def prescription_create():
    """Create new prescription"""
    return create_prescription()

@physician_bp.route('/prescriptions', methods=['GET'])
def prescriptions_get():
    """Get prescriptions"""
    return get_prescriptions()

@physician_bp.route('/prescriptions/<prescription_id>', methods=['GET'])
def prescription_get(prescription_id):
    """Get specific prescription"""
    return get_prescription(prescription_id)

@physician_bp.route('/prescriptions/<prescription_id>', methods=['PUT'])
def prescription_update(prescription_id):
    """Update prescription"""
    return update_prescription(prescription_id)

@physician_bp.route('/prescriptions/<prescription_id>/refill', methods=['POST'])
def prescription_refill(prescription_id):
    """Refill prescription"""
    return refill_prescription(prescription_id)

@physician_bp.route('/prescriptions/<prescription_id>/cancel', methods=['POST'])
def prescription_cancel(prescription_id):
    """Cancel prescription"""
    return cancel_prescription(prescription_id)

# ============================================
# APPOINTMENT ROUTES
# ============================================
@physician_bp.route('/appointments', methods=['POST'])
def appointment_create():
    """Create new appointment"""
    return create_appointment()

@physician_bp.route('/appointments', methods=['GET'])
def appointments_get():
    """Get appointments"""
    return get_appointments()

@physician_bp.route('/appointments/<appointment_id>', methods=['GET'])
def appointment_get(appointment_id):
    """Get specific appointment"""
    return get_appointment(appointment_id)

@physician_bp.route('/appointments/<appointment_id>/confirm', methods=['POST'])
def appointment_confirm(appointment_id):
    """Confirm appointment"""
    return confirm_appointment(appointment_id)

@physician_bp.route('/appointments/<appointment_id>/cancel', methods=['POST'])
def appointment_cancel(appointment_id):
    """Cancel appointment"""
    return cancel_appointment_controller(appointment_id)

@physician_bp.route('/appointments/<appointment_id>/reschedule', methods=['POST'])
def appointment_reschedule(appointment_id):
    """Reschedule appointment"""
    return reschedule_appointment(appointment_id)

@physician_bp.route('/appointments/<appointment_id>/complete', methods=['POST'])
def appointment_complete_route(appointment_id):
    """Complete appointment"""
    return complete_appointment(appointment_id)

# ============================================
# AVAILABILITY SCHEDULE ROUTES
# ============================================
@physician_bp.route('/availability-schedule', methods=['POST'])
def availability_schedule_create():
    """Create availability schedule"""
    return create_availability()

@physician_bp.route('/availability-schedule', methods=['GET'])
def availability_schedule_get():
    """Get availability schedules"""
    return get_availability()

@physician_bp.route('/availability-schedule/<availability_id>', methods=['PUT'])
def availability_schedule_update(availability_id):
    """Update availability schedule"""
    return update_availability_schedule(availability_id)

@physician_bp.route('/availability-schedule/<availability_id>', methods=['DELETE'])
def availability_schedule_delete(availability_id):
    """Delete availability schedule"""
    return delete_availability(availability_id)

# ============================================
# FCM TOKEN MANAGEMENT ROUTES
# ============================================
@physician_bp.route('/fcm-token', methods=['POST'])
def save_fcm_token():
    """Save FCM token for push notifications"""
    return save_physician_fcm_token()

@physician_bp.route('/fcm-token', methods=['DELETE'])
def delete_fcm_token():
    """Delete FCM token (e.g., on logout)"""
    return delete_physician_fcm_token()

# ============================================
# SOAP NOTE / PATIENT CONSULTATION ROUTES
# ============================================
@physician_bp.route('/soap-notes', methods=['POST'])
def soap_note_create():
    """Create a SOAP consultation note or quick vitals log"""
    return create_soap_note()

@physician_bp.route('/patients/<patient_id>/soap-notes', methods=['GET'])
def soap_notes_get(patient_id):
    """Get SOAP notes for a specific patient"""
    return get_patient_soap_notes(patient_id)

@physician_bp.route('/soap-notes/<note_id>', methods=['PUT'])
def soap_note_update(note_id):
    """Update a SOAP note"""
    return update_soap_note(note_id)

@physician_bp.route('/soap-notes/<note_id>', methods=['DELETE'])
def soap_note_delete(note_id):
    """Delete a SOAP note"""
    return delete_soap_note(note_id)
