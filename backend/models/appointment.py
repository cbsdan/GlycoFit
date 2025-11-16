from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class Appointment:
    """Model for scheduled appointments"""
    
    def __init__(self, physician_id, patient_id, appointment_date, duration_minutes=30, appointment_type='Follow-up'):
        self.physician_id = physician_id
        self.patient_id = patient_id
        self.appointment_date = appointment_date
        self.duration_minutes = duration_minutes
        self.appointment_type = appointment_type  # Follow-up, Initial Consultation, Prescription Renewal, Blood Sugar Review, etc.
        self.status = 'pending'  # pending, confirmed, cancelled, completed, no-show
        self.notes = ""
        self.reason = ""
        self.consultation_id = None  # Link to consultation if appointment results in one
        self.reminder_sent = False
        self.cancellation_reason = ""
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert appointment to dictionary for MongoDB storage"""
        return {
            'physician_id': self.physician_id,
            'patient_id': self.patient_id,
            'appointment_date': self.appointment_date,
            'duration_minutes': self.duration_minutes,
            'appointment_type': self.appointment_type,
            'status': self.status,
            'notes': self.notes,
            'reason': self.reason,
            'consultation_id': self.consultation_id,
            'reminder_sent': self.reminder_sent,
            'cancellation_reason': self.cancellation_reason,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create Appointment object from MongoDB document"""
        appointment = cls(
            physician_id=data['physician_id'],
            patient_id=data['patient_id'],
            appointment_date=data['appointment_date'],
            duration_minutes=data.get('duration_minutes', 30),
            appointment_type=data.get('appointment_type', 'Follow-up')
        )
        appointment.status = data.get('status', 'pending')
        appointment.notes = data.get('notes', '')
        appointment.reason = data.get('reason', '')
        appointment.consultation_id = data.get('consultation_id')
        appointment.reminder_sent = data.get('reminder_sent', False)
        appointment.cancellation_reason = data.get('cancellation_reason', '')
        appointment.created_at = data.get('created_at', datetime.utcnow())
        appointment.updated_at = data.get('updated_at', datetime.utcnow())
        return appointment

    def save(self):
        """Save appointment to database"""
        try:
            db = get_db()
            appointment_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.appointments.update_one(
                    {'_id': self._id},
                    {'$set': appointment_data}
                )
                log_database_operation('update_one', 'appointments', {'_id': self._id}, result)
                return result
            else:
                result = db.appointments.insert_one(appointment_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'appointments', appointment_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving appointment: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(appointment_id):
        """Find appointment by ID"""
        try:
            db = get_db()
            data = db.appointments.find_one({'_id': ObjectId(appointment_id)})
            log_database_operation('find_one', 'appointments', {'_id': appointment_id}, data)

            if data:
                appointment = Appointment.from_dict(data)
                appointment._id = data['_id']
                return appointment
            return None

        except Exception as e:
            logging.error(f"Error finding appointment by ID: {str(e)}")
            raise e

    @staticmethod
    def get_physician_appointments(physician_id, start_date=None, end_date=None, status=None, skip=0, limit=50):
        """Get appointments for a physician"""
        try:
            db = get_db()
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {'physician_id': physician_id}
            
            if status:
                query['status'] = status
            
            if start_date or end_date:
                query['appointment_date'] = {}
                if start_date:
                    query['appointment_date']['$gte'] = start_date
                if end_date:
                    query['appointment_date']['$lte'] = end_date
            
            appointments_data = list(db.appointments.find(query)
                                   .sort('appointment_date', 1)
                                   .skip(skip)
                                   .limit(limit))
            log_database_operation('find', 'appointments', query, appointments_data)

            appointments = []
            for data in appointments_data:
                appointment = Appointment.from_dict(data)
                appointment._id = data['_id']
                appointments.append(appointment)

            return appointments

        except Exception as e:
            logging.error(f"Error getting physician appointments: {str(e)}")
            raise e

    @staticmethod
    def get_patient_appointments(patient_id, status=None, skip=0, limit=50):
        """Get appointments for a patient"""
        try:
            db = get_db()
            if isinstance(patient_id, str):
                patient_id = ObjectId(patient_id)
            
            query = {'patient_id': patient_id}
            if status:
                query['status'] = status
            
            appointments_data = list(db.appointments.find(query)
                                   .sort('appointment_date', 1)
                                   .skip(skip)
                                   .limit(limit))
            log_database_operation('find', 'appointments', query, appointments_data)

            appointments = []
            for data in appointments_data:
                appointment = Appointment.from_dict(data)
                appointment._id = data['_id']
                appointments.append(appointment)

            return appointments

        except Exception as e:
            logging.error(f"Error getting patient appointments: {str(e)}")
            raise e

    def confirm(self):
        """Confirm the appointment"""
        self.status = 'confirmed'
        self.updated_at = datetime.utcnow()

    def cancel(self, reason=""):
        """Cancel the appointment"""
        self.status = 'cancelled'
        self.cancellation_reason = reason
        self.updated_at = datetime.utcnow()

    def complete(self, notes="", consultation_id=None):
        """Mark appointment as completed"""
        self.status = 'completed'
        if notes:
            self.notes = notes
        if consultation_id:
            self.consultation_id = consultation_id
        self.updated_at = datetime.utcnow()

    def mark_no_show(self):
        """Mark appointment as no-show"""
        self.status = 'no-show'
        self.updated_at = datetime.utcnow()

    def reschedule(self, new_date, duration_minutes=None):
        """Reschedule the appointment"""
        self.appointment_date = new_date
        if duration_minutes:
            self.duration_minutes = duration_minutes
        self.reminder_sent = False  # Reset reminder flag
        self.updated_at = datetime.utcnow()

    def mark_reminder_sent(self):
        """Mark that reminder has been sent"""
        self.reminder_sent = True
        self.updated_at = datetime.utcnow()

    def to_safe_dict(self):
        """Return appointment data"""
        return {
            'id': str(getattr(self, '_id', '')),
            'physician_id': str(self.physician_id),
            'patient_id': str(self.patient_id),
            'appointment_date': self.appointment_date.isoformat() if self.appointment_date else None,
            'duration_minutes': self.duration_minutes,
            'appointment_type': self.appointment_type,
            'status': self.status,
            'notes': self.notes,
            'reason': self.reason,
            'consultation_id': str(self.consultation_id) if self.consultation_id else None,
            'reminder_sent': self.reminder_sent,
            'cancellation_reason': self.cancellation_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
