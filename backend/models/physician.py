from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
from flask_bcrypt import generate_password_hash, check_password_hash
import logging

class Physician:
    def __init__(self, email, password, first_name, last_name, specialization=None, license_number=None):
        self.email = email.lower().strip()
        self.password = generate_password_hash(password)  # Hash password
        self.first_name = first_name
        self.last_name = last_name
        self.specialization = specialization
        self.license_number = license_number
        self.is_active = True
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert physician object to dictionary for MongoDB storage"""
        return {
            'email': self.email,
            'password': self.password,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'specialization': self.specialization,
            'license_number': self.license_number,
            'is_active': self.is_active,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create Physician object from MongoDB document"""
        physician = cls.__new__(cls)
        physician.email = data['email']
        physician.password = data['password']
        physician.first_name = data['first_name']
        physician.last_name = data['last_name']
        physician.specialization = data.get('specialization')
        physician.license_number = data.get('license_number')
        physician.is_active = data.get('is_active', True)
        physician.created_at = data.get('created_at', datetime.utcnow())
        physician.updated_at = data.get('updated_at', datetime.utcnow())
        return physician

    def check_password(self, password):
        """Verify password"""
        return check_password_hash(self.password, password)

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
    def find_by_email(email):
        """Find physician by email"""
        try:
            db = get_db()
            physician_data = db.physicians.find_one({'email': email.lower().strip()})
            log_database_operation('find_one', 'physicians', {'email': email}, physician_data)

            if physician_data:
                physician = Physician.from_dict(physician_data)
                physician._id = physician_data['_id']
                return physician
            return None

        except Exception as e:
            logging.error(f"Error finding physician by email: {str(e)}")
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

    def to_safe_dict(self):
        """Return physician data without sensitive information"""
        return {
            'id': str(getattr(self, '_id', '')),
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'specialization': self.specialization,
            'license_number': self.license_number,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
