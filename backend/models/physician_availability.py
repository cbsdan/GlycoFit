from datetime import datetime, time
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class PhysicianAvailability:
    """Model for physician availability schedules"""
    
    def __init__(self, physician_id, day_of_week, start_time, end_time, slot_duration_minutes=30):
        self.physician_id = physician_id  # Reference to Physician._id
        self.day_of_week = day_of_week  # 0=Monday, 1=Tuesday, ..., 6=Sunday
        self.start_time = start_time  # datetime.time object
        self.end_time = end_time  # datetime.time object
        self.slot_duration_minutes = slot_duration_minutes  # Default 30 minutes per slot
        self.is_active = True
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert availability to dictionary for MongoDB storage"""
        return {
            'physician_id': self.physician_id,
            'day_of_week': self.day_of_week,
            'start_time': self.start_time.isoformat() if isinstance(self.start_time, time) else self.start_time,
            'end_time': self.end_time.isoformat() if isinstance(self.end_time, time) else self.end_time,
            'slot_duration_minutes': self.slot_duration_minutes,
            'is_active': self.is_active,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create PhysicianAvailability object from MongoDB document"""
        start_time = data['start_time']
        end_time = data['end_time']
        
        # Convert string time to time object if necessary
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time).time()
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time).time()
        
        availability = cls(
            physician_id=data['physician_id'],
            day_of_week=data['day_of_week'],
            start_time=start_time,
            end_time=end_time,
            slot_duration_minutes=data.get('slot_duration_minutes', 30)
        )
        availability.is_active = data.get('is_active', True)
        availability.created_at = data.get('created_at', datetime.utcnow())
        availability.updated_at = data.get('updated_at', datetime.utcnow())
        return availability

    def save(self):
        """Save availability to database"""
        try:
            db = get_db()
            availability_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.physician_availability.update_one(
                    {'_id': self._id},
                    {'$set': availability_data}
                )
                log_database_operation('update_one', 'physician_availability', {'_id': self._id}, result)
                return result
            else:
                result = db.physician_availability.insert_one(availability_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'physician_availability', availability_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving physician availability: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(availability_id):
        """Find availability by ID"""
        try:
            db = get_db()
            data = db.physician_availability.find_one({'_id': ObjectId(availability_id)})
            log_database_operation('find_one', 'physician_availability', {'_id': availability_id}, data)

            if data:
                availability = PhysicianAvailability.from_dict(data)
                availability._id = data['_id']
                return availability
            return None

        except Exception as e:
            logging.error(f"Error finding availability by ID: {str(e)}")
            raise e

    @staticmethod
    def get_physician_availability(physician_id, day_of_week=None, is_active=True):
        """Get availability schedules for a physician"""
        try:
            db = get_db()
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            
            query = {'physician_id': physician_id}
            
            if day_of_week is not None:
                query['day_of_week'] = day_of_week
            
            if is_active is not None:
                query['is_active'] = is_active
            
            availability_data = list(db.physician_availability.find(query).sort('day_of_week', 1))
            log_database_operation('find', 'physician_availability', query, availability_data)

            availabilities = []
            for data in availability_data:
                availability = PhysicianAvailability.from_dict(data)
                availability._id = data['_id']
                availabilities.append(availability)

            return availabilities

        except Exception as e:
            logging.error(f"Error getting physician availability: {str(e)}")
            raise e

    @staticmethod
    def delete_by_id(availability_id):
        """Delete availability by ID"""
        try:
            db = get_db()
            result = db.physician_availability.delete_one({'_id': ObjectId(availability_id)})
            log_database_operation('delete_one', 'physician_availability', {'_id': availability_id}, result)
            return result.deleted_count > 0

        except Exception as e:
            logging.error(f"Error deleting availability: {str(e)}")
            raise e

    def deactivate(self):
        """Deactivate this availability schedule"""
        self.is_active = False
        self.updated_at = datetime.utcnow()

    def activate(self):
        """Activate this availability schedule"""
        self.is_active = True
        self.updated_at = datetime.utcnow()

    def to_safe_dict(self):
        """Return availability data"""
        return {
            'id': str(getattr(self, '_id', '')),
            'physician_id': str(self.physician_id),
            'day_of_week': self.day_of_week,
            'start_time': self.start_time.isoformat() if isinstance(self.start_time, time) else self.start_time,
            'end_time': self.end_time.isoformat() if isinstance(self.end_time, time) else self.end_time,
            'slot_duration_minutes': self.slot_duration_minutes,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
