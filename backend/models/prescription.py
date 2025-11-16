from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class Prescription:
    """Model for medication prescriptions"""
    
    def __init__(self, physician_id, patient_id, medication_name, dosage, frequency):
        self.physician_id = physician_id
        self.patient_id = patient_id
        self.medication_name = medication_name
        self.dosage = dosage
        self.frequency = frequency
        self.duration_days = None
        self.quantity = None
        self.refills_allowed = 0
        self.refills_remaining = 0
        self.status = 'active'  # active, completed, cancelled, expired
        self.instructions = ""
        self.side_effects_warning = ""
        self.consultation_id = None  # Reference to consultation if prescribed during consultation
        self.prescribed_date = datetime.utcnow()
        self.start_date = datetime.utcnow()
        self.end_date = None
        self.pharmacy_notes = ""
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert prescription to dictionary for MongoDB storage"""
        return {
            'physician_id': self.physician_id,
            'patient_id': self.patient_id,
            'medication_name': self.medication_name,
            'dosage': self.dosage,
            'frequency': self.frequency,
            'duration_days': self.duration_days,
            'quantity': self.quantity,
            'refills_allowed': self.refills_allowed,
            'refills_remaining': self.refills_remaining,
            'status': self.status,
            'instructions': self.instructions,
            'side_effects_warning': self.side_effects_warning,
            'consultation_id': self.consultation_id,
            'prescribed_date': self.prescribed_date,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'pharmacy_notes': self.pharmacy_notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create Prescription object from MongoDB document"""
        prescription = cls(
            physician_id=data['physician_id'],
            patient_id=data['patient_id'],
            medication_name=data['medication_name'],
            dosage=data['dosage'],
            frequency=data['frequency']
        )
        prescription.duration_days = data.get('duration_days')
        prescription.quantity = data.get('quantity')
        prescription.refills_allowed = data.get('refills_allowed', 0)
        prescription.refills_remaining = data.get('refills_remaining', 0)
        prescription.status = data.get('status', 'active')
        prescription.instructions = data.get('instructions', '')
        prescription.side_effects_warning = data.get('side_effects_warning', '')
        prescription.consultation_id = data.get('consultation_id')
        prescription.prescribed_date = data.get('prescribed_date', datetime.utcnow())
        prescription.start_date = data.get('start_date', datetime.utcnow())
        prescription.end_date = data.get('end_date')
        prescription.pharmacy_notes = data.get('pharmacy_notes', '')
        prescription.created_at = data.get('created_at', datetime.utcnow())
        prescription.updated_at = data.get('updated_at', datetime.utcnow())
        return prescription

    def save(self):
        """Save prescription to database"""
        try:
            db = get_db()
            prescription_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.prescriptions.update_one(
                    {'_id': self._id},
                    {'$set': prescription_data}
                )
                log_database_operation('update_one', 'prescriptions', {'_id': self._id}, result)
                return result
            else:
                result = db.prescriptions.insert_one(prescription_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'prescriptions', prescription_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving prescription: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(prescription_id):
        """Find prescription by ID"""
        try:
            db = get_db()
            data = db.prescriptions.find_one({'_id': ObjectId(prescription_id)})
            log_database_operation('find_one', 'prescriptions', {'_id': prescription_id}, data)

            if data:
                prescription = Prescription.from_dict(data)
                prescription._id = data['_id']
                return prescription
            return None

        except Exception as e:
            logging.error(f"Error finding prescription by ID: {str(e)}")
            raise e

    @staticmethod
    def get_physician_prescriptions(physician_id, status=None, skip=0, limit=50):
        """Get prescriptions created by a physician"""
        try:
            db = get_db()
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {'physician_id': physician_id}
            if status:
                query['status'] = status
            
            prescriptions_data = list(db.prescriptions.find(query)
                                    .sort('prescribed_date', -1)
                                    .skip(skip)
                                    .limit(limit))
            log_database_operation('find', 'prescriptions', query, prescriptions_data)

            prescriptions = []
            for data in prescriptions_data:
                prescription = Prescription.from_dict(data)
                prescription._id = data['_id']
                prescriptions.append(prescription)

            return prescriptions

        except Exception as e:
            logging.error(f"Error getting physician prescriptions: {str(e)}")
            raise e

    @staticmethod
    def get_patient_prescriptions(patient_id, status=None, skip=0, limit=50):
        """Get prescriptions for a patient"""
        try:
            db = get_db()
            if isinstance(patient_id, str):
                patient_id = ObjectId(patient_id)
            
            query = {'patient_id': patient_id}
            if status:
                query['status'] = status
            
            prescriptions_data = list(db.prescriptions.find(query)
                                    .sort('prescribed_date', -1)
                                    .skip(skip)
                                    .limit(limit))
            log_database_operation('find', 'prescriptions', query, prescriptions_data)

            prescriptions = []
            for data in prescriptions_data:
                prescription = Prescription.from_dict(data)
                prescription._id = data['_id']
                prescriptions.append(prescription)

            return prescriptions

        except Exception as e:
            logging.error(f"Error getting patient prescriptions: {str(e)}")
            raise e

    def refill(self):
        """Process a refill for the prescription"""
        if self.refills_remaining > 0:
            self.refills_remaining -= 1
            self.updated_at = datetime.utcnow()
            return True
        return False

    def cancel(self, reason=""):
        """Cancel the prescription"""
        self.status = 'cancelled'
        if reason:
            self.pharmacy_notes = reason
        self.updated_at = datetime.utcnow()

    def complete(self):
        """Mark prescription as completed"""
        self.status = 'completed'
        self.updated_at = datetime.utcnow()

    def expire(self):
        """Mark prescription as expired"""
        self.status = 'expired'
        self.updated_at = datetime.utcnow()

    def update_status(self, status):
        """Update prescription status"""
        self.status = status
        self.updated_at = datetime.utcnow()

    def to_safe_dict(self):
        """Return prescription data"""
        return {
            'id': str(getattr(self, '_id', '')),
            'physician_id': str(self.physician_id),
            'patient_id': str(self.patient_id),
            'medication_name': self.medication_name,
            'dosage': self.dosage,
            'frequency': self.frequency,
            'duration_days': self.duration_days,
            'quantity': self.quantity,
            'refills_allowed': self.refills_allowed,
            'refills_remaining': self.refills_remaining,
            'status': self.status,
            'instructions': self.instructions,
            'side_effects_warning': self.side_effects_warning,
            'consultation_id': str(self.consultation_id) if self.consultation_id else None,
            'prescribed_date': self.prescribed_date.isoformat() if self.prescribed_date else None,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'pharmacy_notes': self.pharmacy_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
