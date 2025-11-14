from datetime import datetime
from bson import ObjectId

class UserActivity:
    def __init__(self, db):
        self.collection = db['user_activities']
        self._create_indexes()
    
    def _create_indexes(self):
        """Create indexes for efficient querying"""
        self.collection.create_index([("uid", 1), ("date", -1)])
        self.collection.create_index([("uid", 1), ("activity_type", 1)])
    
    def save_daily_activity(self, uid, date, activity_data):
        """Save or update daily activity data"""
        try:
            # Convert date to datetime for MongoDB compatibility
            if isinstance(date, datetime):
                date_datetime = date
            else:
                # If it's a date object, convert to datetime at midnight
                date_datetime = datetime.combine(date, datetime.min.time())
            
            result = self.collection.update_one(
                {
                    "uid": uid,
                    "date": date_datetime,
                    "activity_type": "daily"
                },
                {
                    "$set": {
                        "uid": uid,
                        "date": date_datetime,
                        "activity_type": "daily",
                        "steps": activity_data.get("steps", 0),
                        "distance": activity_data.get("distance", 0),
                        "active_calories": activity_data.get("active_calories", 0),
                        "total_calories": activity_data.get("total_calories", 0),
                        "updated_at": datetime.utcnow()
                    },
                    "$setOnInsert": {
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            return result.modified_count > 0 or result.upserted_id is not None
        except Exception as e:
            print(f"Error saving daily activity: {e}")
            return False
    
    def save_exercise_session(self, uid, session_data):
        """Save an exercise session"""
        try:
            session = {
                "uid": uid,
                "activity_type": "exercise",
                "exercise_type": session_data.get("exercise_type"),
                "start_time": session_data.get("start_time"),
                "end_time": session_data.get("end_time"),
                "duration": session_data.get("duration"),
                "calories": session_data.get("calories"),
                "distance": session_data.get("distance"),
                "created_at": datetime.utcnow()
            }
            result = self.collection.insert_one(session)
            return str(result.inserted_id)
        except Exception as e:
            print(f"Error saving exercise session: {e}")
            return None
    
    def get_activity_by_date_range(self, uid, start_date, end_date):
        """Get activity data for a date range"""
        try:
            # Convert dates to datetime for MongoDB query
            if not isinstance(start_date, datetime):
                start_datetime = datetime.combine(start_date, datetime.min.time())
            else:
                start_datetime = start_date
            
            if not isinstance(end_date, datetime):
                end_datetime = datetime.combine(end_date, datetime.max.time())
            else:
                end_datetime = end_date
            
            activities = list(self.collection.find({
                "uid": uid,
                "date": {
                    "$gte": start_datetime,
                    "$lte": end_datetime
                },
                "activity_type": "daily"
            }).sort("date", -1))
            
            for activity in activities:
                activity['_id'] = str(activity['_id'])
                # Convert datetime back to date string for API response
                if isinstance(activity.get('date'), datetime):
                    activity['date'] = activity['date'].strftime('%Y-%m-%d')
            
            return activities
        except Exception as e:
            print(f"Error getting activities: {e}")
            return []
    
    def get_exercise_sessions(self, uid, start_time, end_time, limit=50):
        """Get exercise sessions"""
        try:
            sessions = list(self.collection.find({
                "uid": uid,
                "activity_type": "exercise",
                "start_time": {
                    "$gte": start_time,
                    "$lte": end_time
                }
            }).sort("start_time", -1).limit(limit))
            
            for session in sessions:
                session['_id'] = str(session['_id'])
            
            return sessions
        except Exception as e:
            print(f"Error getting exercise sessions: {e}")
            return []
    
    def get_activity_summary(self, uid, start_date, end_date):
        """Get aggregated activity summary"""
        try:
            # Convert dates to datetime for MongoDB query
            if not isinstance(start_date, datetime):
                start_datetime = datetime.combine(start_date, datetime.min.time())
            else:
                start_datetime = start_date
            
            if not isinstance(end_date, datetime):
                end_datetime = datetime.combine(end_date, datetime.max.time())
            else:
                end_datetime = end_date
            
            pipeline = [
                {
                    "$match": {
                        "uid": uid,
                        "activity_type": "daily",
                        "date": {
                            "$gte": start_datetime,
                            "$lte": end_datetime
                        }
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total_steps": {"$sum": "$steps"},
                        "total_distance": {"$sum": "$distance"},
                        "total_active_calories": {"$sum": "$active_calories"},
                        "total_calories": {"$sum": "$total_calories"},
                        "avg_steps": {"$avg": "$steps"},
                        "days_count": {"$sum": 1}
                    }
                }
            ]
            
            result = list(self.collection.aggregate(pipeline))
            return result[0] if result else None
        except Exception as e:
            print(f"Error getting activity summary: {e}")
            return None