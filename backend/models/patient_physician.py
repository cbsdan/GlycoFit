from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class PatientPhysician:
    """Model for patient-physician relationships"""
    
    def __init__(self, patient_id, physician_id, status='pending'):
        self.patient_id = patient_id  # Reference to User._id with role='user'
        self.physician_id = physician_id  # Reference to Physician._id
        self.status = status  # pending, active, inactive, declined
        self.request_date = datetime.utcnow()
        self.acceptance_date = None
        self.notes = ""
        self.urgency = 'low'  # low, medium, high
        self.reason = ""  # Reason for requesting this physician
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert relationship to dictionary for MongoDB storage"""
        return {
            'patient_id': self.patient_id,
            'physician_id': self.physician_id,
            'status': self.status,
            'request_date': self.request_date,
            'acceptance_date': self.acceptance_date,
            'notes': self.notes,
            'urgency': self.urgency,
            'reason': self.reason,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create PatientPhysician object from MongoDB document"""
        relationship = cls(
            patient_id=data['patient_id'],
            physician_id=data['physician_id'],
            status=data.get('status', 'pending')
        )
        relationship.request_date = data.get('request_date', datetime.utcnow())
        relationship.acceptance_date = data.get('acceptance_date')
        relationship.notes = data.get('notes', '')
        relationship.urgency = data.get('urgency', 'low')
        relationship.reason = data.get('reason', '')
        relationship.created_at = data.get('created_at', datetime.utcnow())
        relationship.updated_at = data.get('updated_at', datetime.utcnow())
        return relationship

    def save(self):
        """Save relationship to database"""
        try:
            db = get_db()
            relationship_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.patient_physicians.update_one(
                    {'_id': self._id},
                    {'$set': relationship_data}
                )
                log_database_operation('update_one', 'patient_physicians', {'_id': self._id}, result)
                return result
            else:
                result = db.patient_physicians.insert_one(relationship_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'patient_physicians', relationship_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving patient-physician relationship: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(relationship_id):
        """Find relationship by ID"""
        try:
            db = get_db()
            data = db.patient_physicians.find_one({'_id': ObjectId(relationship_id)})
            log_database_operation('find_one', 'patient_physicians', {'_id': relationship_id}, data)

            if data:
                relationship = PatientPhysician.from_dict(data)
                relationship._id = data['_id']
                return relationship
            return None

        except Exception as e:
            logging.error(f"Error finding relationship by ID: {str(e)}")
            raise e

    @staticmethod
    def find_by_patient_and_physician(patient_id, physician_id, status=None):
        """Find relationship between specific patient and physician
        
        Args:
            patient_id: The patient's user ID
            physician_id: The physician's ID
            status: Optional status filter ('active', 'pending', 'inactive', 'declined')
        """
        try:
            db = get_db()
            if isinstance(patient_id, str):
                patient_id = ObjectId(patient_id)
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {
                'patient_id': patient_id,
                'physician_id': physician_id
            }
            if status:
                query['status'] = status
            
            data = db.patient_physicians.find_one(query)
            log_database_operation('find_one', 'patient_physicians', query, data)

            if data:
                relationship = PatientPhysician.from_dict(data)
                relationship._id = data['_id']
                return relationship
            return None

        except Exception as e:
            logging.error(f"Error finding relationship: {str(e)}")
            raise e

    @staticmethod
    def get_physician_patients(physician_id, status=None, skip=0, limit=50):
        """Get all patients for a physician"""
        try:
            db = get_db()
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {'physician_id': physician_id}
            if status:
                query['status'] = status
            
            relationships_data = list(db.patient_physicians.find(query).skip(skip).limit(limit))
            log_database_operation('find', 'patient_physicians', query, relationships_data)

            relationships = []
            for data in relationships_data:
                relationship = PatientPhysician.from_dict(data)
                relationship._id = data['_id']
                relationships.append(relationship)

            return relationships

        except Exception as e:
            logging.error(f"Error getting physician patients: {str(e)}")
            raise e

    @staticmethod
    def get_patient_physicians(patient_id, status=None):
        """Get all physicians for a patient"""
        try:
            db = get_db()
            if isinstance(patient_id, str):
                patient_id = ObjectId(patient_id)
            
            query = {'patient_id': patient_id}
            if status:
                query['status'] = status
            
            relationships_data = list(db.patient_physicians.find(query))
            log_database_operation('find', 'patient_physicians', query, relationships_data)

            relationships = []
            for data in relationships_data:
                relationship = PatientPhysician.from_dict(data)
                relationship._id = data['_id']
                relationships.append(relationship)

            return relationships

        except Exception as e:
            logging.error(f"Error getting patient physicians: {str(e)}")
            raise e

    def accept(self, notes=""):
        """Accept patient request"""
        self.status = 'active'
        self.acceptance_date = datetime.utcnow()
        if notes:
            self.notes = notes
        self.updated_at = datetime.utcnow()

    def decline(self, notes=""):
        """Decline patient request"""
        self.status = 'declined'
        if notes:
            self.notes = notes
        self.updated_at = datetime.utcnow()

    def deactivate(self, notes=""):
        """Deactivate relationship"""
        self.status = 'inactive'
        if notes:
            self.notes = notes
        self.updated_at = datetime.utcnow()

    def to_safe_dict(self):
        """Return relationship data"""
        return {
            'id': str(getattr(self, '_id', '')),
            'patient_id': str(self.patient_id),
            'physician_id': str(self.physician_id),
            'status': self.status,
            'request_date': self.request_date.isoformat() if self.request_date else None,
            'acceptance_date': self.acceptance_date.isoformat() if self.acceptance_date else None,
            'notes': self.notes,
            'urgency': self.urgency,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
