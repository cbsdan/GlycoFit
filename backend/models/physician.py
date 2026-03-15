from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class Physician:
    """Model for physician-specific data extending the User model"""
    
    def __init__(self, user_id, specialization='Endocrinologist', license_number=None, 
                 years_of_experience=0, education=None, certifications=None):
        self.user_id = user_id  # Reference to User._id
        self.specialization = specialization
        self.license_number = license_number
        self.years_of_experience = years_of_experience
        self.education = education or []
        self.certifications = certifications or []
        self.is_active = True  # Availability status
        self.consultation_fee = 0.0
        self.rating = 0.0
        self.total_consultations = 0
        self.total_patients = 0
        self.bio = ""
        self.languages = []
        self.working_hours = {
            'monday': {'start': '09:00', 'end': '17:00', 'available': True},
            'tuesday': {'start': '09:00', 'end': '17:00', 'available': True},
            'wednesday': {'start': '09:00', 'end': '17:00', 'available': True},
            'thursday': {'start': '09:00', 'end': '17:00', 'available': True},
            'friday': {'start': '09:00', 'end': '17:00', 'available': True},
            'saturday': {'start': '09:00', 'end': '13:00', 'available': False},
            'sunday': {'start': '09:00', 'end': '13:00', 'available': False}
        }
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        # Consultation templates stored per-physician
        self.consultation_templates = []

    def to_dict(self):
        """Convert physician object to dictionary for MongoDB storage"""
        return {
            'user_id': self.user_id,
            'specialization': self.specialization,
            'license_number': self.license_number,
            'years_of_experience': self.years_of_experience,
            'education': self.education,
            'certifications': self.certifications,
            'is_active': self.is_active,
            'consultation_fee': self.consultation_fee,
            'rating': self.rating,
            'total_consultations': self.total_consultations,
            'total_patients': self.total_patients,
            'bio': self.bio,
            'languages': self.languages,
            'working_hours': self.working_hours,
            'consultation_templates': self.consultation_templates,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create Physician object from MongoDB document"""
        physician = cls(
            user_id=data['user_id'],
            specialization=data.get('specialization', 'Endocrinologist'),
            license_number=data.get('license_number'),
            years_of_experience=data.get('years_of_experience', 0),
            education=data.get('education', []),
            certifications=data.get('certifications', [])
        )
        physician.is_active = data.get('is_active', True)
        physician.consultation_fee = data.get('consultation_fee', 0.0)
        physician.rating = data.get('rating', 0.0)
        physician.total_consultations = data.get('total_consultations', 0)
        physician.total_patients = data.get('total_patients', 0)
        physician.bio = data.get('bio', '')
        physician.languages = data.get('languages', [])
        physician.working_hours = data.get('working_hours', physician.working_hours)
        physician.created_at = data.get('created_at', datetime.utcnow())
        physician.updated_at = data.get('updated_at', datetime.utcnow())
        physician.consultation_templates = data.get('consultation_templates', [])
        return physician

    def save(self):
        """Save physician to database"""
        try:
            db = get_db()
            physician_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.physicians.update_one(
                    {'_id': self._id},
                    {'$set': physician_data}
                )
                log_database_operation('update_one', 'physicians', {'_id': self._id}, result)
                return result
            else:
                result = db.physicians.insert_one(physician_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'physicians', physician_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving physician: {str(e)}")
            raise e

    @staticmethod
    def find_by_user_id(user_id):
        """Find physician by user_id"""
        try:
            db = get_db()
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            
            physician_data = db.physicians.find_one({'user_id': user_id})
            log_database_operation('find_one', 'physicians', {'user_id': user_id}, physician_data)

            if physician_data:
                physician = Physician.from_dict(physician_data)
                physician._id = physician_data['_id']
                return physician
            return None

        except Exception as e:
            logging.error(f"Error finding physician by user_id: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(physician_id):
        """Find physician by MongoDB ObjectId"""
        try:
            db = get_db()
            physician_data = db.physicians.find_one({'_id': ObjectId(physician_id)})
            log_database_operation('find_one', 'physicians', {'_id': physician_id}, physician_data)

            if physician_data:
                physician = Physician.from_dict(physician_data)
                physician._id = physician_data['_id']
                return physician
            return None

        except Exception as e:
            logging.error(f"Error finding physician by ID: {str(e)}")
            raise e

    @staticmethod
    def get_all_physicians(skip=0, limit=50, active_only=False):
        """Get all physicians with pagination"""
        try:
            db = get_db()
            query = {'is_active': True} if active_only else {}
            physicians_data = list(db.physicians.find(query).skip(skip).limit(limit))
            log_database_operation('find', 'physicians', {'skip': skip, 'limit': limit}, physicians_data)

            physicians = []
            for physician_data in physicians_data:
                physician = Physician.from_dict(physician_data)
                physician._id = physician_data['_id']
                physicians.append(physician)

            return physicians

        except Exception as e:
            logging.error(f"Error getting all physicians: {str(e)}")
            raise e

    def update_availability(self, is_active):
        """Update physician availability status"""
        self.is_active = is_active
        self.updated_at = datetime.utcnow()

    def update_stats(self, total_patients=None, total_consultations=None, rating=None):
        """Update physician statistics"""
        if total_patients is not None:
            self.total_patients = total_patients
        if total_consultations is not None:
            self.total_consultations = total_consultations
        if rating is not None:
            self.rating = rating
        self.updated_at = datetime.utcnow()

    def to_safe_dict(self):
        """Return physician data without sensitive information"""
        return {
            'id': str(getattr(self, '_id', '')),
            'user_id': str(self.user_id),
            'specialization': self.specialization,
            'license_number': self.license_number,
            'years_of_experience': self.years_of_experience,
            'education': self.education,
            'certifications': self.certifications,
            'is_active': self.is_active,
            'consultation_fee': self.consultation_fee,
            'rating': self.rating,
            'total_consultations': self.total_consultations,
            'total_patients': self.total_patients,
            'bio': self.bio,
            'languages': self.languages,
            'working_hours': self.working_hours,
            'consultation_templates': self.consultation_templates,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
