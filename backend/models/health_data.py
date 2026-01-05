from datetime import datetime, timedelta
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class HealthData:
    """Model for storing Health Connect data synced from mobile"""
    
    def __init__(self, user_id, data_type, value, unit, timestamp, metadata=None):
        """
        Initialize HealthData
        
        Args:
            user_id: User's UID from Firebase
            data_type: Type of health data (heart_rate, exercise, active_calories)
            value: Numeric value of the measurement
            unit: Unit of measurement (bpm, kcal, minutes, etc.)
            timestamp: ISO timestamp of when the measurement was taken
            metadata: Additional data (exercise type, duration, etc.)
        """
        self.user_id = user_id
        self.data_type = data_type
        
        # Ensure value is a float
        try:
            self.value = float(value)
        except (ValueError, TypeError) as e:
            logging.error(f"Error converting value to float: {value}, error: {str(e)}")
            raise ValueError(f"Invalid value: {value} must be numeric")
        
        self.unit = unit
        
        # Convert timestamp to datetime if it's a string with better error handling
        # Remove timezone info to match existing data in MongoDB
        try:
            original_timestamp = timestamp
            if isinstance(timestamp, str):
                # Handle various ISO formats
                timestamp_clean = timestamp.replace('Z', '+00:00')
                dt = datetime.fromisoformat(timestamp_clean)
                # Remove timezone info for consistency with existing data
                self.timestamp = dt.replace(tzinfo=None)
            elif isinstance(timestamp, datetime):
                # Remove timezone info if present
                self.timestamp = timestamp.replace(tzinfo=None)
            else:
                # Try to parse as string
                dt = datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                self.timestamp = dt.replace(tzinfo=None)
            
            logging.debug(f"Timestamp conversion: '{original_timestamp}' -> {self.timestamp} (type: {data_type})")
        except (ValueError, AttributeError) as e:
            logging.error(f"Error parsing timestamp '{timestamp}': {str(e)}")
            # Use current time as fallback
            self.timestamp = datetime.utcnow()
            
        self.metadata = metadata or {}
        self.synced_at = datetime.utcnow()
        self.created_at = datetime.utcnow()

    def to_dict(self):
        """Convert to dictionary for MongoDB storage"""
        try:
            return {
                'user_id': self.user_id,
                'data_type': self.data_type,
                'value': float(self.value),  # Ensure it's a float
                'unit': self.unit,
                'timestamp': self.timestamp,
                'metadata': self.metadata if isinstance(self.metadata, dict) else {},
                'synced_at': self.synced_at,
                'created_at': self.created_at
            }
        except Exception as e:
            logging.error(f"Error converting HealthData to dict: {str(e)}, data: {self.__dict__}")
            raise e

    @classmethod
    def from_dict(cls, data):
        """Create HealthData object from MongoDB document"""
        health_data = cls(
            user_id=data['user_id'],
            data_type=data['data_type'],
            value=data['value'],
            unit=data['unit'],
            timestamp=data['timestamp'],
            metadata=data.get('metadata', {})
        )
        health_data.synced_at = data.get('synced_at', datetime.utcnow())
        health_data.created_at = data.get('created_at', datetime.utcnow())
        return health_data

    def save(self):
        """Save health data to database"""
        try:
            db = get_db()
            health_data = self.to_dict()
            
            # Check if data with same timestamp already exists to avoid duplicates
            existing = db.health_data.find_one({
                'user_id': self.user_id,
                'data_type': self.data_type,
                'timestamp': self.timestamp
            })
            
            if existing:
                logging.info(f"Health data already exists for {self.data_type} at {self.timestamp}")
                return None
            
            result = db.health_data.insert_one(health_data)
            self._id = result.inserted_id
            log_database_operation('insert_one', 'health_data', health_data, result)
            return result
        except Exception as e:
            logging.error(f"Error saving health data: {str(e)}")
            raise e

    @staticmethod
    def bulk_insert(health_data_list):
        """
        Bulk insert multiple health data records, avoiding duplicates
        Optimized to check all duplicates in a single query
        
        Args:
            health_data_list: List of HealthData objects
            
        Returns:
            Number of records inserted
        """
        try:
            if not health_data_list:
                return 0
                
            db = get_db()
            
            # Create compound index for faster lookups if not exists
            try:
                db.health_data.create_index([
                    ('user_id', 1),
                    ('data_type', 1),
                    ('timestamp', 1)
                ], unique=True, background=True)
            except Exception:
                pass  # Index might already exist
            
            # Build query to check all timestamps at once
            user_id = health_data_list[0].user_id
            data_types = list(set([hd.data_type for hd in health_data_list]))
            timestamps = [hd.timestamp for hd in health_data_list]
            
            # Get existing records in one query
            existing_records = db.health_data.find({
                'user_id': user_id,
                'data_type': {'$in': data_types},
                'timestamp': {'$in': timestamps}
            }, {'timestamp': 1, 'data_type': 1})
            
            # Create set of existing (data_type, timestamp) tuples for O(1) lookup
            existing_set = {(rec['data_type'], rec['timestamp']) for rec in existing_records}
            
            # Filter out duplicates
            new_records = [
                hd.to_dict() for hd in health_data_list
                if (hd.data_type, hd.timestamp) not in existing_set
            ]
            
            # Bulk insert new records
            inserted_count = 0
            if new_records:
                try:
                    result = db.health_data.insert_many(new_records, ordered=False)
                    inserted_count = len(result.inserted_ids)
                except Exception as insert_error:
                    # If there are duplicate key errors, some records may still have been inserted
                    # Extract the number of successfully inserted records from the error
                    error_str = str(insert_error)
                    if 'nInserted' in error_str:
                        # Parse the error to get nInserted count
                        import re
                        match = re.search(r"'nInserted': (\d+)", error_str)
                        if match:
                            inserted_count = int(match.group(1))
                            logging.warning(f"Partial insert: {inserted_count} records inserted, some duplicates skipped")
                        else:
                            logging.error(f"Error in bulk insert but couldn't parse nInserted: {error_str}")
                            raise insert_error
                    else:
                        logging.error(f"Error in bulk insert: {error_str}")
                        raise insert_error
            
            logging.info(f"Bulk inserted {inserted_count}/{len(health_data_list)} health data records")
            return inserted_count
        except Exception as e:
            logging.error(f"Error in bulk insert: {str(e)}")
            raise e

    @staticmethod
    def get_user_data(user_id, data_type=None, start_date=None, end_date=None, limit=50, skip=0):
        """
        Get health data for a user with optional filters
        Optimized with pagination and indexing
        
        Args:
            user_id: User's UID
            data_type: Optional filter by data type
            start_date: Optional start date filter
            end_date: Optional end date filter
            limit: Maximum number of records to return (default 50)
            skip: Number of records to skip for pagination (default 0)
            
        Returns:
            List of health data records
        """
        try:
            db = get_db()
            
            # Create indexes for faster queries
            try:
                db.health_data.create_index([('user_id', 1), ('timestamp', -1)], background=True)
                db.health_data.create_index([('user_id', 1), ('data_type', 1), ('timestamp', -1)], background=True)
            except Exception:
                pass  # Indexes might already exist
            
            query = {'user_id': user_id}
            
            if data_type:
                query['data_type'] = data_type
            
            if start_date or end_date:
                query['timestamp'] = {}
                if start_date:
                    if isinstance(start_date, str):
                        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    query['timestamp']['$gte'] = start_date
                if end_date:
                    if isinstance(end_date, str):
                        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    query['timestamp']['$lte'] = end_date
            
            # Use projection to only fetch needed fields, sort by timestamp descending, apply limit
            records = list(db.health_data.find(query).sort('timestamp', -1).skip(skip).limit(limit))
            log_database_operation('find', 'health_data', query, {'count': len(records), 'limit': limit})
            
            return [HealthData.from_dict(record) for record in records]
        except Exception as e:
            logging.error(f"Error getting user data: {str(e)}")
            raise e

    @staticmethod
    def get_daily_statistics(user_id, date, data_type):
        """
        Get statistics for a specific day
        
        Args:
            user_id: User's UID
            date: Date to get statistics for
            data_type: Type of data (heart_rate, exercise, active_calories)
            
        Returns:
            Dictionary with statistics (total, average, min, max, count)
        """
        try:
            db = get_db()
            
            if isinstance(date, str):
                date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            
            # Remove timezone to match database records (stored without timezone)
            if isinstance(date, datetime) and date.tzinfo is not None:
                date = date.replace(tzinfo=None)
            
            start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = start_of_day + timedelta(days=1)
            
            logging.info(f"Daily stats query: user={user_id}, type={data_type}, start={start_of_day}, end={end_of_day}")
            
            # Check what records exist for debugging
            sample_records = list(db.health_data.find({
                'user_id': user_id,
                'data_type': data_type
            }).sort('timestamp', -1).limit(3))
            
            if sample_records:
                logging.info(f"Sample records in DB: {[(r['timestamp'], r['value']) for r in sample_records]}")
            else:
                logging.info(f"No records found for user={user_id}, type={data_type}")
            
            pipeline = [
                {
                    '$match': {
                        'user_id': user_id,
                        'data_type': data_type,
                        'timestamp': {
                            '$gte': start_of_day,
                            '$lt': end_of_day
                        }
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total': {'$sum': '$value'},
                        'average': {'$avg': '$value'},
                        'min': {'$min': '$value'},
                        'max': {'$max': '$value'},
                        'count': {'$sum': 1}
                    }
                }
            ]
            
            result = list(db.health_data.aggregate(pipeline))
            
            logging.info(f"📊 Daily Stats Result: {result}")
            
            if result:
                stats = result[0]
                return {
                    'date': date.isoformat(),
                    'data_type': data_type,
                    'total': stats.get('total', 0),
                    'average': round(stats.get('average', 0), 2),
                    'min': stats.get('min', 0),
                    'max': stats.get('max', 0),
                    'count': stats.get('count', 0)
                }
            
            return {
                'date': start_of_day.isoformat(),
                'data_type': data_type,
                'total': 0,
                'average': 0,
                'min': 0,
                'max': 0,
                'count': 0
            }
        except Exception as e:
            logging.error(f"Error getting daily statistics: {str(e)}")
            raise e

    @staticmethod
    def get_weekly_statistics(user_id, start_date, data_type):
        """
        Get statistics for a week (7 days from start_date)
        
        Args:
            user_id: User's UID
            start_date: Start date of the week
            data_type: Type of data
            
        Returns:
            Dictionary with weekly statistics
        """
        try:
            db = get_db()
            
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            
            # Remove timezone to match database records (stored without timezone)
            if isinstance(start_date, datetime) and start_date.tzinfo is not None:
                start_date = start_date.replace(tzinfo=None)
            
            start_of_week = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_week = start_of_week + timedelta(days=7)
            
            logging.info(f"Weekly stats query: user={user_id}, type={data_type}, start={start_of_week}, end={end_of_week}")
            
            # Check what records exist for debugging
            sample_records = list(db.health_data.find({
                'user_id': user_id,
                'data_type': data_type
            }).sort('timestamp', -1).limit(5))
            
            if sample_records:
                logging.info(f"Sample records in DB: {[(r['timestamp'], r['value']) for r in sample_records]}")
            else:
                logging.info(f"No records found for user={user_id}, type={data_type}")
            
            pipeline = [
                {
                    '$match': {
                        'user_id': user_id,
                        'data_type': data_type,
                        'timestamp': {
                            '$gte': start_of_week,
                            '$lt': end_of_week
                        }
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total': {'$sum': '$value'},
                        'average': {'$avg': '$value'},
                        'min': {'$min': '$value'},
                        'max': {'$max': '$value'},
                        'count': {'$sum': 1}
                    }
                }
            ]
            
            result = list(db.health_data.aggregate(pipeline))
            
            # Check how many records match the query
            matching_count = db.health_data.count_documents({
                'user_id': user_id,
                'data_type': data_type,
                'timestamp': {'$gte': start_of_week, '$lt': end_of_week}
            })
            logging.info(f"📊 Weekly Stats - Matching records in range: {matching_count}")
            logging.info(f"📊 Weekly Stats Result: {result}")
            
            if result:
                stats = result[0]
                return {
                    'start_date': start_of_week.isoformat(),
                    'end_date': end_of_week.isoformat(),
                    'data_type': data_type,
                    'total': stats.get('total', 0),
                    'average': round(stats.get('average', 0), 2),
                    'min': stats.get('min', 0),
                    'max': stats.get('max', 0),
                    'count': stats.get('count', 0)
                }
            
            return {
                'start_date': start_of_week.isoformat(),
                'end_date': end_of_week.isoformat(),
                'data_type': data_type,
                'total': 0,
                'average': 0,
                'min': 0,
                'max': 0,
                'count': 0
            }
        except Exception as e:
            logging.error(f"Error getting weekly statistics: {str(e)}")
            raise e

    @staticmethod
    def get_monthly_statistics(user_id, year, month, data_type):
        """
        Get statistics for a specific month
        
        Args:
            user_id: User's UID
            year: Year (e.g., 2025)
            month: Month (1-12)
            data_type: Type of data
            
        Returns:
            Dictionary with monthly statistics
        """
        try:
            db = get_db()
            
            start_of_month = datetime(year, month, 1)
            if month == 12:
                end_of_month = datetime(year + 1, 1, 1)
            else:
                end_of_month = datetime(year, month + 1, 1)
            
            pipeline = [
                {
                    '$match': {
                        'user_id': user_id,
                        'data_type': data_type,
                        'timestamp': {
                            '$gte': start_of_month,
                            '$lt': end_of_month
                        }
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total': {'$sum': '$value'},
                        'average': {'$avg': '$value'},
                        'min': {'$min': '$value'},
                        'max': {'$max': '$value'},
                        'count': {'$sum': 1}
                    }
                }
            ]
            
            result = list(db.health_data.aggregate(pipeline))
            
            if result:
                stats = result[0]
                return {
                    'year': year,
                    'month': month,
                    'start_date': start_of_month.isoformat(),
                    'end_date': end_of_month.isoformat(),
                    'data_type': data_type,
                    'total': stats.get('total', 0),
                    'average': round(stats.get('average', 0), 2),
                    'min': stats.get('min', 0),
                    'max': stats.get('max', 0),
                    'count': stats.get('count', 0)
                }
            
            return {
                'year': year,
                'month': month,
                'start_date': start_of_month.isoformat(),
                'end_date': end_of_month.isoformat(),
                'data_type': data_type,
                'total': 0,
                'average': 0,
                'min': 0,
                'max': 0,
                'count': 0
            }
        except Exception as e:
            logging.error(f"Error getting monthly statistics: {str(e)}")
            raise e

    @staticmethod
    def get_latest_sync_timestamp(user_id, data_type):
        """
        Get the timestamp of the latest synced data for a user and data type
        
        Args:
            user_id: User's UID
            data_type: Type of data
            
        Returns:
            Datetime of latest sync or None
        """
        try:
            db = get_db()
            latest = db.health_data.find_one(
                {'user_id': user_id, 'data_type': data_type},
                sort=[('timestamp', -1)]
            )
            
            if latest:
                return latest['timestamp']
            return None
        except Exception as e:
            logging.error(f"Error getting latest sync timestamp: {str(e)}")
            raise e
