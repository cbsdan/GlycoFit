from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class Consultation:
    """Model for consultations between physicians and patients"""
    
    def __init__(self, physician_id, patient_id, consultation_type='video', 
                 scheduled_date=None, duration_minutes=30):
        self.physician_id = physician_id
        self.patient_id = patient_id
        self.consultation_type = consultation_type  # video, chat, in-person
        self.scheduled_date = scheduled_date or datetime.utcnow()
        self.duration_minutes = duration_minutes
        self.status = 'scheduled'  # scheduled, in-progress, completed, cancelled, no-show
        self.reason = ""
        self.notes = ""
        self.diagnosis = ""
        self.treatment_plan = ""
        self.follow_up_required = False
        self.follow_up_date = None
        self.meeting_url = ""  # For video consultations
        self.meeting_id = ""
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
            'duration_minutes': self.duration_minutes,
            'status': self.status,
            'reason': self.reason,
            'notes': self.notes,
            'diagnosis': self.diagnosis,
            'treatment_plan': self.treatment_plan,
            'follow_up_required': self.follow_up_required,
            'follow_up_date': self.follow_up_date,
            'meeting_url': self.meeting_url,
            'meeting_id': self.meeting_id,
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
            duration_minutes=data.get('duration_minutes', 30)
        )
        consultation.status = data.get('status', 'scheduled')
        consultation.reason = data.get('reason', '')
        consultation.notes = data.get('notes', '')
        consultation.diagnosis = data.get('diagnosis', '')
        consultation.treatment_plan = data.get('treatment_plan', '')
        consultation.follow_up_required = data.get('follow_up_required', False)
        consultation.follow_up_date = data.get('follow_up_date')
        consultation.meeting_url = data.get('meeting_url', '')
        consultation.meeting_id = data.get('meeting_id', '')
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
            'physician_id': str(self.physician_id),
            'patient_id': str(self.patient_id),
            'consultation_type': self.consultation_type,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'duration_minutes': self.duration_minutes,
            'status': self.status,
            'reason': self.reason,
            'notes': self.notes,
            'diagnosis': self.diagnosis,
            'treatment_plan': self.treatment_plan,
            'follow_up_required': self.follow_up_required,
            'follow_up_date': self.follow_up_date.isoformat() if self.follow_up_date else None,
            'meeting_url': self.meeting_url,
            'meeting_id': self.meeting_id,
            'actual_start_time': self.actual_start_time.isoformat() if self.actual_start_time else None,
            'actual_end_time': self.actual_end_time.isoformat() if self.actual_end_time else None,
            'patient_rating': self.patient_rating,
            'patient_feedback': self.patient_feedback,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
