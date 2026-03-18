from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class Consultation:
    """Model for consultations between physicians and patients"""
    
    # Status constants
    STATUS_PENDING = 'pending'      # Patient requested, waiting for physician approval
    STATUS_APPROVED = 'approved'    # Physician approved with meeting details
    STATUS_REJECTED = 'rejected'    # Physician rejected the request
    STATUS_SCHEDULED = 'scheduled'  # Legacy - same as approved
    STATUS_IN_PROGRESS = 'in-progress'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_NO_SHOW = 'no-show'
    
    # Platform constants
    PLATFORM_GOOGLE_MEET = 'google_meet'
    PLATFORM_ZOOM = 'zoom'
    PLATFORM_OTHER = 'other'
    
    def __init__(self, physician_id, patient_id, consultation_type='video', 
                 scheduled_date=None, scheduled_time=None, duration_minutes=30):
        self.physician_id = physician_id
        self.patient_id = patient_id
        self.consultation_type = consultation_type  # video, chat, in-person
        self.scheduled_date = scheduled_date or datetime.utcnow()
        self.scheduled_time = scheduled_time  # Time string e.g., "14:00"
        self.duration_minutes = duration_minutes
        self.status = self.STATUS_PENDING  # pending, approved, rejected, in-progress, completed, cancelled, no-show
        self.reason = ""
        self.notes = ""
        self.diagnosis = ""
        self.treatment_plan = ""
        self.follow_up_required = False
        self.follow_up_date = None
        
        # SOAP Note fields
        self.soap_subjective = ""   # Patient complaints / history
        self.soap_objective = {
            'fasting_blood_sugar': None,
            'ogtt': None,
            'hba1c': None,
            'image_url': None,
            'image_public_id': None
        }     # Vitals & physical exam findings
        self.soap_assessment = ""   # Diagnosis
        self.soap_plan = ""         # Treatment / lifestyle advice
        self.soap_prescriptions = [] # Prescription list from plan
        self.consultation_mode = "full"  # 'quick_vitals' or 'full'
        
        # Extracted source info for quick vitals
        self.source = "physician"  # 'physician' or 'user'
        self.source_id = None      # ID of the user or physician who inputted it
        self.source_name = ""      # Name of the user or physician who inputted it
        
        # Meeting platform details
        self.platform = self.PLATFORM_GOOGLE_MEET  # google_meet, zoom, other
        self.meeting_link = ""  # Full meeting URL
        self.meeting_password = ""  # Meeting password if any
        self.meeting_url = ""  # Legacy - same as meeting_link
        self.meeting_id = ""  # Meeting ID from platform
        
        # Physician response
        self.rejection_reason = ""  # Reason if rejected
        self.approved_at = None
        self.rejected_at = None
        
        self.actual_start_time = None
        self.actual_end_time = None
        self.patient_rating = None
        self.patient_feedback = ""
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert consultation to dictionary for MongoDB storage"""
        return {
            'physician_id': self.physician_id,
            'patient_id': self.patient_id,
            'consultation_type': self.consultation_type,
            'scheduled_date': self.scheduled_date,
            'scheduled_time': self.scheduled_time,
            'duration_minutes': self.duration_minutes,
            'status': self.status,
            'reason': self.reason,
            'notes': self.notes,
            'diagnosis': self.diagnosis,
            'treatment_plan': self.treatment_plan,
            'follow_up_required': self.follow_up_required,
            'follow_up_date': self.follow_up_date,
            'soap_subjective': self.soap_subjective,
            'soap_objective': self.soap_objective,
            'soap_assessment': self.soap_assessment,
            'soap_plan': self.soap_plan,
            'soap_prescriptions': self.soap_prescriptions,
            'consultation_mode': self.consultation_mode,
            'source': self.source,
            'source_id': self.source_id,
            'source_name': self.source_name,
            'platform': self.platform,
            'meeting_link': self.meeting_link,
            'meeting_password': self.meeting_password,
            'meeting_url': self.meeting_url,
            'meeting_id': self.meeting_id,
            'rejection_reason': self.rejection_reason,
            'approved_at': self.approved_at,
            'rejected_at': self.rejected_at,
            'actual_start_time': self.actual_start_time,
            'actual_end_time': self.actual_end_time,
            'patient_rating': self.patient_rating,
            'patient_feedback': self.patient_feedback,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create Consultation object from MongoDB document"""
        consultation = cls(
            physician_id=data['physician_id'],
            patient_id=data['patient_id'],
            consultation_type=data.get('consultation_type', 'video'),
            scheduled_date=data.get('scheduled_date'),
            scheduled_time=data.get('scheduled_time'),
            duration_minutes=data.get('duration_minutes', 30)
        )
        consultation.status = data.get('status', cls.STATUS_PENDING)
        consultation.reason = data.get('reason', '')
        consultation.notes = data.get('notes', '')
        consultation.diagnosis = data.get('diagnosis', '')
        consultation.treatment_plan = data.get('treatment_plan', '')
        consultation.follow_up_required = data.get('follow_up_required', False)
        consultation.follow_up_date = data.get('follow_up_date')
        consultation.soap_subjective = data.get('soap_subjective', '')
        consultation.soap_objective = data.get('soap_objective', {})
        consultation.soap_assessment = data.get('soap_assessment', '')
        consultation.soap_plan = data.get('soap_plan', '')
        consultation.soap_prescriptions = data.get('soap_prescriptions', [])
        consultation.consultation_mode = data.get('consultation_mode', 'full')
        
        consultation.source = data.get('source', 'physician')
        consultation.source_id = data.get('source_id')
        consultation.source_name = data.get('source_name', '')
        
        consultation.platform = data.get('platform', cls.PLATFORM_GOOGLE_MEET)
        consultation.meeting_link = data.get('meeting_link', '')
        consultation.meeting_password = data.get('meeting_password', '')
        consultation.meeting_url = data.get('meeting_url', '')
        consultation.meeting_id = data.get('meeting_id', '')
        consultation.rejection_reason = data.get('rejection_reason', '')
        consultation.approved_at = data.get('approved_at')
        consultation.rejected_at = data.get('rejected_at')
        consultation.actual_start_time = data.get('actual_start_time')
        consultation.actual_end_time = data.get('actual_end_time')
        consultation.patient_rating = data.get('patient_rating')
        consultation.patient_feedback = data.get('patient_feedback', '')
        consultation.created_at = data.get('created_at', datetime.utcnow())
        consultation.updated_at = data.get('updated_at', datetime.utcnow())
        return consultation

    def save(self):
        """Save consultation to database"""
        try:
            db = get_db()
            consultation_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.consultations.update_one(
                    {'_id': self._id},
                    {'$set': consultation_data}
                )
                log_database_operation('update_one', 'consultations', {'_id': self._id}, result)
                return result
            else:
                result = db.consultations.insert_one(consultation_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'consultations', consultation_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving consultation: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(consultation_id):
        """Find consultation by ID"""
        try:
            db = get_db()
            data = db.consultations.find_one({'_id': ObjectId(consultation_id)})
            log_database_operation('find_one', 'consultations', {'_id': consultation_id}, data)

            if data:
                consultation = Consultation.from_dict(data)
                consultation._id = data['_id']
                return consultation
            return None

        except Exception as e:
            logging.error(f"Error finding consultation by ID: {str(e)}")
            raise e

    @staticmethod
    def get_physician_consultations(physician_id, status=None, start_date=None, end_date=None, skip=0, limit=50):
        """Get consultations for a physician"""
        try:
            db = get_db()
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {'physician_id': physician_id}
            
            if status:
                query['status'] = status
            
            if start_date or end_date:
                query['scheduled_date'] = {}
                if start_date:
                    query['scheduled_date']['$gte'] = start_date
                if end_date:
                    query['scheduled_date']['$lte'] = end_date
            
            consultations_data = list(db.consultations.find(query)
                                    .sort('scheduled_date', -1)
                                    .skip(skip)
                                    .limit(limit))
            log_database_operation('find', 'consultations', query, consultations_data)

            consultations = []
            for data in consultations_data:
                consultation = Consultation.from_dict(data)
                consultation._id = data['_id']
                consultations.append(consultation)

            return consultations

        except Exception as e:
            logging.error(f"Error getting physician consultations: {str(e)}")
            raise e

    @staticmethod
    def get_patient_consultations(patient_id, status=None, skip=0, limit=50):
        """Get consultations for a patient"""
        try:
            db = get_db()
            if isinstance(patient_id, str):
                patient_id = ObjectId(patient_id)
            
            query = {'patient_id': patient_id}
            if status:
                query['status'] = status
            
            consultations_data = list(db.consultations.find(query)
                                    .sort('scheduled_date', -1)
                                    .skip(skip)
                                    .limit(limit))
            log_database_operation('find', 'consultations', query, consultations_data)

            consultations = []
            for data in consultations_data:
                consultation = Consultation.from_dict(data)
                consultation._id = data['_id']
                consultations.append(consultation)

            return consultations

        except Exception as e:
            logging.error(f"Error getting patient consultations: {str(e)}")
            raise e

    def start_consultation(self):
        """Mark consultation as in progress"""
        self.status = 'in-progress'
        self.actual_start_time = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def complete_consultation(self, notes="", diagnosis="", treatment_plan="", follow_up_required=False):
        """Mark consultation as completed"""
        self.status = 'completed'
        self.actual_end_time = datetime.utcnow()
        if notes:
            self.notes = notes
        if diagnosis:
            self.diagnosis = diagnosis
        if treatment_plan:
            self.treatment_plan = treatment_plan
        self.follow_up_required = follow_up_required
        self.updated_at = datetime.utcnow()

    def cancel_consultation(self, reason=""):
        """Cancel consultation"""
        self.status = 'cancelled'
        if reason:
            self.notes = reason
        self.updated_at = datetime.utcnow()

    def reschedule(self, new_date, duration_minutes=None):
        """Reschedule consultation"""
        self.scheduled_date = new_date
        if duration_minutes:
            self.duration_minutes = duration_minutes
        self.updated_at = datetime.utcnow()

    def add_rating(self, rating, feedback=""):
        """Add patient rating and feedback"""
        self.patient_rating = rating
        self.patient_feedback = feedback
        self.updated_at = datetime.utcnow()

    def to_safe_dict(self):
        """Return consultation data"""
        return {
            'id': str(getattr(self, '_id', '')),
            'physician_id': str(self.physician_id) if getattr(self, 'physician_id', None) else None,
            'patient_id': str(self.patient_id),
            'consultation_type': self.consultation_type,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'scheduled_time': self.scheduled_time,
            'duration_minutes': self.duration_minutes,
            'status': self.status,
            'reason': self.reason,
            'notes': self.notes,
            'diagnosis': self.diagnosis,
            'treatment_plan': self.treatment_plan,
            'follow_up_required': self.follow_up_required,
            'follow_up_date': self.follow_up_date.isoformat() if self.follow_up_date else None,
            'soap_subjective': self.soap_subjective,
            'soap_objective': self.soap_objective,
            'soap_assessment': self.soap_assessment,
            'soap_plan': self.soap_plan,
            'soap_prescriptions': self.soap_prescriptions,
            'consultation_mode': self.consultation_mode,
            'source': self.source,
            'source_id': self.source_id,
            'source_name': self.source_name,
            'platform': self.platform,
            'meeting_link': self.meeting_link,
            'meeting_password': self.meeting_password,
            'meeting_url': self.meeting_url,
            'meeting_id': self.meeting_id,
            'rejection_reason': self.rejection_reason,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'rejected_at': self.rejected_at.isoformat() if self.rejected_at else None,
            'actual_start_time': self.actual_start_time.isoformat() if self.actual_start_time else None,
            'actual_end_time': self.actual_end_time.isoformat() if self.actual_end_time else None,
            'patient_rating': self.patient_rating,
            'patient_feedback': self.patient_feedback,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def approve(self, scheduled_date=None, scheduled_time=None):
        """Physician approves the consultation request"""
        self.status = self.STATUS_APPROVED
        self.approved_at = datetime.utcnow()
        if scheduled_date:
            self.scheduled_date = scheduled_date
        if scheduled_time:
            self.scheduled_time = scheduled_time
        self.updated_at = datetime.utcnow()

    def reject(self, reason=""):
        """Physician rejects the consultation request"""
        self.status = self.STATUS_REJECTED
        self.rejection_reason = reason
        self.rejected_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    @staticmethod
    def get_pending_for_physician(physician_id, skip=0, limit=50):
        """Get pending consultation requests for a physician"""
        try:
            db = get_db()
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {
                'physician_id': physician_id,
                'status': Consultation.STATUS_PENDING
            }
            
            consultations_data = list(db.consultations.find(query)
                                    .sort('created_at', -1)
                                    .skip(skip)
                                    .limit(limit))
            log_database_operation('find', 'consultations', query, consultations_data)

            consultations = []
            for data in consultations_data:
                consultation = Consultation.from_dict(data)
                consultation._id = data['_id']
                consultations.append(consultation)

            return consultations

        except Exception as e:
            logging.error(f"Error getting pending consultations: {str(e)}")
            raise e

    @staticmethod
    def get_approved_for_physician(physician_id, start_date=None, end_date=None, skip=0, limit=50):
        """Get approved/scheduled consultations for a physician (for calendar)"""
        try:
            db = get_db()
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {
                'physician_id': physician_id,
                'status': {'$in': [Consultation.STATUS_APPROVED, Consultation.STATUS_SCHEDULED]}
            }
            
            if start_date or end_date:
                query['scheduled_date'] = {}
                if start_date:
                    query['scheduled_date']['$gte'] = start_date
                if end_date:
                    query['scheduled_date']['$lte'] = end_date
            
            consultations_data = list(db.consultations.find(query)
                                    .sort('scheduled_date', 1)
                                    .skip(skip)
                                    .limit(limit))
            log_database_operation('find', 'consultations', query, consultations_data)

            consultations = []
            for data in consultations_data:
                consultation = Consultation.from_dict(data)
                consultation._id = data['_id']
                consultations.append(consultation)

            return consultations

        except Exception as e:
            logging.error(f"Error getting approved consultations: {str(e)}")
            raise e
