from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class HeartRate:
    def __init__(self, user_id, heart_rate, confidence_level=None, activity_context=None, notes=None):
        self.user_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        self.heart_rate = heart_rate
        self.confidence_level = confidence_level
        self.activity_context = activity_context
        self.notes = notes
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert heart rate object to dictionary for MongoDB storage"""
        return {
            'user_id': self.user_id,
            'heart_rate': self.heart_rate,
            'confidence_level': self.confidence_level,
            'activity_context': self.activity_context,
            'notes': self.notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    def save(self):
        """Save heart rate record to database"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            heart_rate_data = self.to_dict()
            result = collection.insert_one(heart_rate_data)
            
            log_database_operation('CREATE', 'heart_rates', str(result.inserted_id))
            logging.info(f"Heart rate record created with ID: {result.inserted_id}")
            
            return str(result.inserted_id)
        except Exception as e:
            logging.error(f"Error saving heart rate record: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(heart_rate_id):
        """Find heart rate record by ID"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            heart_rate_data = collection.find_one({'_id': ObjectId(heart_rate_id)})
            log_database_operation('READ', 'heart_rates', heart_rate_id)
            
            if heart_rate_data:
                # Convert ObjectId to string for JSON serialization
                heart_rate_data['_id'] = str(heart_rate_data['_id'])
                heart_rate_data['user_id'] = str(heart_rate_data['user_id'])
                return heart_rate_data
            return None
        except Exception as e:
            logging.error(f"Error finding heart rate record by ID {heart_rate_id}: {str(e)}")
            return None

    @staticmethod
    def find_by_user_id(user_id, limit=None, skip=0, sort_by='created_at', sort_order=-1):
        """Find heart rate records by user ID with pagination and sorting"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            query = {'user_id': ObjectId(user_id)}
            cursor = collection.find(query).sort(sort_by, sort_order).skip(skip)
            
            if limit:
                cursor = cursor.limit(limit)
            
            heart_rates = []
            for heart_rate_data in cursor:
                heart_rate_data['_id'] = str(heart_rate_data['_id'])
                heart_rate_data['user_id'] = str(heart_rate_data['user_id'])
                heart_rates.append(heart_rate_data)
            
            log_database_operation('READ', 'heart_rates', f"user_id: {user_id}")
            logging.info(f"Found {len(heart_rates)} heart rate records for user {user_id}")
            
            return heart_rates
        except Exception as e:
            logging.error(f"Error finding heart rate records for user {user_id}: {str(e)}")
            return []

    @staticmethod
    def find_by_date_range(user_id, start_date, end_date):
        """Find heart rate records by user ID within a date range"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            query = {
                'user_id': ObjectId(user_id),
                'created_at': {
                    '$gte': start_date,
                    '$lte': end_date
                }
            }
            
            heart_rates = []
            for heart_rate_data in collection.find(query).sort('created_at', -1):
                heart_rate_data['_id'] = str(heart_rate_data['_id'])
                heart_rate_data['user_id'] = str(heart_rate_data['user_id'])
                heart_rates.append(heart_rate_data)
            
            log_database_operation('READ', 'heart_rates', f"user_id: {user_id}, date_range: {start_date} to {end_date}")
            logging.info(f"Found {len(heart_rates)} heart rate records for user {user_id} in date range")
            
            return heart_rates
        except Exception as e:
            logging.error(f"Error finding heart rate records by date range: {str(e)}")
            return []

    @staticmethod
    def update_by_id(heart_rate_id, update_data):
        """Update heart rate record by ID"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            # Add updated_at timestamp
            update_data['updated_at'] = datetime.utcnow()
            
            result = collection.update_one(
                {'_id': ObjectId(heart_rate_id)},
                {'$set': update_data}
            )
            
            log_database_operation('UPDATE', 'heart_rates', heart_rate_id)
            logging.info(f"Heart rate record {heart_rate_id} updated. Modified count: {result.modified_count}")
            
            return result.modified_count > 0
        except Exception as e:
            logging.error(f"Error updating heart rate record {heart_rate_id}: {str(e)}")
            return False

    @staticmethod
    def delete_by_id(heart_rate_id):
        """Delete heart rate record by ID"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            result = collection.delete_one({'_id': ObjectId(heart_rate_id)})
            
            log_database_operation('DELETE', 'heart_rates', heart_rate_id)
            logging.info(f"Heart rate record {heart_rate_id} deleted. Deleted count: {result.deleted_count}")
            
            return result.deleted_count > 0
        except Exception as e:
            logging.error(f"Error deleting heart rate record {heart_rate_id}: {str(e)}")
            return False

    @staticmethod
    def get_latest_by_user_id(user_id):
        """Get the latest heart rate record for a user"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            heart_rate_data = collection.find_one(
                {'user_id': ObjectId(user_id)},
                sort=[('created_at', -1)]
            )
            
            log_database_operation('READ', 'heart_rates', f"latest for user_id: {user_id}")
            
            if heart_rate_data:
                heart_rate_data['_id'] = str(heart_rate_data['_id'])
                heart_rate_data['user_id'] = str(heart_rate_data['user_id'])
                return heart_rate_data
            return None
        except Exception as e:
            logging.error(f"Error getting latest heart rate for user {user_id}: {str(e)}")
            return None

    @staticmethod
    def get_statistics(user_id, start_date=None, end_date=None):
        """Get heart rate statistics for a user"""
        try:
            db = get_db()
            collection = db.heart_rates
            
            match_query = {'user_id': ObjectId(user_id)}
            
            if start_date and end_date:
                match_query['created_at'] = {
                    '$gte': start_date,
                    '$lte': end_date
                }
            
            pipeline = [
                {'$match': match_query},
                {
                    '$group': {
                        '_id': None,
                        'avg_heart_rate': {'$avg': '$heart_rate'},
                        'min_heart_rate': {'$min': '$heart_rate'},
                        'max_heart_rate': {'$max': '$heart_rate'},
                        'count': {'$sum': 1}
                    }
                }
            ]
            
            result = list(collection.aggregate(pipeline))
            
            log_database_operation('READ', 'heart_rates', f"statistics for user_id: {user_id}")
            
            if result:
                stats = result[0]
                # Remove the _id field and round the average
                del stats['_id']
                if stats['avg_heart_rate']:
                    stats['avg_heart_rate'] = round(stats['avg_heart_rate'], 2)
                return stats
            
            return {
                'avg_heart_rate': None,
                'min_heart_rate': None,
                'max_heart_rate': None,
                'count': 0
            }
        except Exception as e:
            logging.error(f"Error getting heart rate statistics for user {user_id}: {str(e)}")
            return None
