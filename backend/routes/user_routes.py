from flask import Blueprint
from controllers.auth_controller import AuthController
from controllers.user_info_controller import UserInfoController
from controllers.nutrient_controller import NutrientController
from controllers.patient_physician_controller import (
    get_available_physicians,
    send_physician_request,
    get_my_physician,
    cancel_physician_request,
    disconnect_physician
)
from controllers.patient_appointment_controller import (
    create_patient_appointment,
    get_patient_appointments,
    get_patient_appointment,
    cancel_patient_appointment,
    reschedule_patient_appointment
)
from controllers.patient_prescription_controller import (
    get_patient_prescriptions,
    get_patient_prescription,
    request_prescription_refill
)
from controllers.patient_consultation_controller import (
    create_patient_consultation,
    get_patient_consultations,
    get_patient_consultation,
    cancel_patient_consultation,
    reschedule_patient_consultation,
    rate_consultation
)
from middleware.firebase_auth import firebase_auth_required
from flask import g

user_bp = Blueprint('users', __name__)

@user_bp.before_request
@firebase_auth_required
def before_user_request():
    """Set up g.current_user for all user routes"""
    from flask import request
    g.current_user = getattr(request, 'current_user', None)

# Profile Routes
@user_bp.route('/profile', methods=['GET'])
def get_profile():
    # This will be handled by JWT middleware
    pass

@user_bp.route('/profile', methods=['PUT'])
def update_profile():
    return AuthController.update_my_profile()

# User Info Routes
@user_bp.route('/user-info', methods=['GET'])
def get_all_user_info():
    return UserInfoController.get_all_user_info()

@user_bp.route('/user-info/<info_user_id>', methods=['GET'])
def get_user_info(info_user_id):
    return UserInfoController.get_user_info(info_user_id)

@user_bp.route('/user-info', methods=['POST'])
def create_user_info():
    return UserInfoController.create_user_info()

@user_bp.route('/user-info/<info_id>', methods=['PUT'])
def update_user_info(info_id):
    return UserInfoController.update_user_info(info_id)

@user_bp.route('/user-info/<info_id>', methods=['DELETE'])
def delete_user_info(info_id):
    return UserInfoController.delete_user_info(info_id)


# Meal Management Routes
@user_bp.route('/meals', methods=['GET'])
def get_user_meals():
    """Get user's meal history"""
    return NutrientController.get_user_meals()

@user_bp.route('/meals/<meal_id>', methods=['GET'])
def get_meal_by_id(meal_id):
    """Get a specific meal by ID"""
    return NutrientController.get_meal_by_id(meal_id)

@user_bp.route('/meals/<meal_id>', methods=['PUT'])
def update_meal(meal_id):
    """Update meal details"""
    return NutrientController.update_meal(meal_id)

@user_bp.route('/meals/<meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    """Delete a meal record"""
    return NutrientController.delete_meal(meal_id)

@user_bp.route('/nutrition-summary', methods=['GET'])
def get_nutrition_summary():
    """Get nutrition summary for the user"""
    return NutrientController.get_nutrition_summary()

# Physician Management Routes for Patients
@user_bp.route('/physicians/available', methods=['GET'])
def get_physicians():
    """Get all available physicians that patient can request"""
    return get_available_physicians()

@user_bp.route('/physicians/request', methods=['POST'])
def request_physician():
    """Send request to a physician"""
    return send_physician_request()

@user_bp.route('/physicians/my-physician', methods=['GET'])
def my_physician():
    """Get patient's current physician(s)"""
    return get_my_physician()

@user_bp.route('/physicians/requests/<request_id>/cancel', methods=['POST'])
def cancel_request(request_id):
    """Cancel a pending physician request"""
    return cancel_physician_request(request_id)

@user_bp.route('/physicians/relationship/<relationship_id>/disconnect', methods=['POST'])
def disconnect(relationship_id):
    """Disconnect from a physician"""
    return disconnect_physician(relationship_id)

@user_bp.route('/physicians/<physician_id>/available-slots', methods=['GET'])
def get_physician_slots(physician_id):
    """Get available appointment slots for a physician"""
    from controllers.availability_controller import get_physician_available_slots
    return get_physician_available_slots(physician_id)

# Appointment Management Routes for Patients
@user_bp.route('/appointments', methods=['POST'])
def create_appointment():
    """Create a new appointment with physician"""
    return create_patient_appointment()

@user_bp.route('/appointments', methods=['GET'])
def get_appointments():
    """Get patient's appointments"""
    return get_patient_appointments()

@user_bp.route('/appointments/<appointment_id>', methods=['GET'])
def get_appointment(appointment_id):
    """Get specific appointment"""
    return get_patient_appointment(appointment_id)

@user_bp.route('/appointments/<appointment_id>/cancel', methods=['POST'])
def cancel_appointment(appointment_id):
    """Cancel an appointment"""
    return cancel_patient_appointment(appointment_id)

@user_bp.route('/appointments/<appointment_id>/reschedule', methods=['POST'])
def reschedule_appointment(appointment_id):
    """Reschedule an appointment"""
    return reschedule_patient_appointment(appointment_id)

# Prescription Management Routes for Patients
@user_bp.route('/prescriptions', methods=['GET'])
def get_prescriptions():
    """Get patient's prescriptions"""
    return get_patient_prescriptions()

@user_bp.route('/prescriptions/<prescription_id>', methods=['GET'])
def get_prescription(prescription_id):
    """Get specific prescription"""
    return get_patient_prescription(prescription_id)

@user_bp.route('/prescriptions/<prescription_id>/refill', methods=['POST'])
def request_refill(prescription_id):
    """Request prescription refill"""
    return request_prescription_refill(prescription_id)

# Consultation Management Routes for Patients
@user_bp.route('/consultations', methods=['POST'])
def create_consultation():
    """Request a new consultation"""
    return create_patient_consultation()

@user_bp.route('/consultations', methods=['GET'])
def get_consultations():
    """Get patient's consultations"""
    return get_patient_consultations()

@user_bp.route('/consultations/<consultation_id>', methods=['GET'])
def get_consultation(consultation_id):
    """Get specific consultation"""
    return get_patient_consultation(consultation_id)

@user_bp.route('/consultations/<consultation_id>/cancel', methods=['POST'])
def cancel_consultation(consultation_id):
    """Cancel a consultation"""
    return cancel_patient_consultation(consultation_id)

@user_bp.route('/consultations/<consultation_id>/reschedule', methods=['POST'])
def reschedule_consultation(consultation_id):
    """Reschedule a consultation"""
    return reschedule_patient_consultation(consultation_id)

@user_bp.route('/consultations/<consultation_id>/rate', methods=['POST'])
def rate_consultation_route(consultation_id):
    """Rate a completed consultation"""
    return rate_consultation(consultation_id)
