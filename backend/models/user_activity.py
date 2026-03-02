from datetime import datetime
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

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
            from datetime import timezone
            
            print(f"💾 Saving to MongoDB:")
            print(f"  - Collection: {self.collection.name}")
            print(f"  - UID: {uid}")
            print(f"  - Date: {date}")
            print(f"  - Data: {activity_data}")
            
            # Convert date to UTC-aware datetime for MongoDB compatibility
            if isinstance(date, datetime):
                date_datetime = date
                # Make sure it's UTC-aware
                if date_datetime.tzinfo is None:
                    date_datetime = date_datetime.replace(tzinfo=timezone.utc)
            else:
                date_datetime = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)
            
            print(f"  - Date as datetime: {date_datetime} (UTC-aware)")
            
            query = {
                "uid": uid,
                "date": date_datetime,
                "activity_type": "daily"
            }
            print(f"  - Query: {query}")
            
            # Build the update document
            set_fields = {
                "uid": uid,
                "date": date_datetime,
                "activity_type": "daily",
                "updated_at": datetime.utcnow(),
                "last_synced_at": datetime.utcnow(),
                "source": activity_data.get('source')
            }
            
            # Use $max to ensure we always keep the highest value
            max_fields = {}
            
            # Track which fields we're using $max for
            using_max = set()
            
            # Only update if the value is greater than 0
            if activity_data.get("steps", 0) > 0:
                max_fields["steps"] = activity_data.get("steps")
                using_max.add("steps")
            
            if activity_data.get("distance", 0) > 0:
                max_fields["distance"] = activity_data.get("distance")
                using_max.add("distance")
            
            if activity_data.get("active_calories", 0) > 0:
                max_fields["active_calories"] = activity_data.get("active_calories")
                using_max.add("active_calories")
            
            if activity_data.get("total_calories", 0) > 0:
                max_fields["total_calories"] = activity_data.get("total_calories")
                using_max.add("total_calories")
            
            # Build $setOnInsert - only include fields NOT in $max
            set_on_insert = {
                "created_at": datetime.utcnow()
            }
            
            # Add default 0 values only for fields NOT being updated with $max
            if "steps" not in using_max:
                set_on_insert["steps"] = 0
            if "distance" not in using_max:
                set_on_insert["distance"] = 0
            if "active_calories" not in using_max:
                set_on_insert["active_calories"] = 0
            if "total_calories" not in using_max:
                set_on_insert["total_calories"] = 0
            
            # Build update operation
            update = {
                "$set": set_fields,
                "$setOnInsert": set_on_insert
            }
            
            # Only add $max if we have fields to maximize
            if max_fields:
                update["$max"] = max_fields
            
            print(f"  - Update: {update}")
            
            result = self.collection.update_one(query, update, upsert=True)
            
            print(f"✅ MongoDB Result:")
            print(f"  - Modified: {result.modified_count}")
            print(f"  - Upserted ID: {result.upserted_id}")
            print(f"  - Matched: {result.matched_count}")
            
            # Verify what was saved
            saved_doc = self.collection.find_one(query)
            print(f"  - Document after save: {saved_doc}")
            
            return result.modified_count > 0 or result.upserted_id is not None
        except Exception as e:
            print(f"❌ Error saving daily activity: {e}")
            import traceback
            traceback.print_exc()
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
            from datetime import timezone, date as date_type
            
            def _to_utc_datetime(d, end_of_day=False):
                """Accept str, datetime.date, or datetime and return UTC-aware datetime."""
                if isinstance(d, datetime):
                    return d if d.tzinfo is not None else d.replace(tzinfo=timezone.utc)
                if isinstance(d, date_type):
                    t = datetime.max.time() if end_of_day else datetime.min.time()
                    return datetime.combine(d, t).replace(tzinfo=timezone.utc)
                # Assume string
                parsed = datetime.strptime(d, '%Y-%m-%d').date()
                t = datetime.max.time() if end_of_day else datetime.min.time()
                return datetime.combine(parsed, t).replace(tzinfo=timezone.utc)

            start_date = _to_utc_datetime(start_date, end_of_day=False)
            end_date = _to_utc_datetime(end_date, end_of_day=True)
            
            logger.debug("get_activity_by_date_range: uid=%s start=%s end=%s", uid, start_date, end_date)
            
            query = {
                "uid": uid,
                "date": {"$gte": start_date, "$lte": end_date}
            }
            
            activities = list(self.collection.find(query).sort("date", -1))
            logger.debug("get_activity_by_date_range: found %d activities for uid=%s", len(activities), uid)
            
            if len(activities) == 0:
                # Debug: check if there are ANY records for this user
                any_records = list(self.collection.find({"uid": uid}).limit(3))
                logger.debug("get_activity_by_date_range: total records for uid=%s: %d", uid, len(any_records))
            
            # Convert ObjectId to string
            for activity in activities:
                activity['_id'] = str(activity['_id'])
                # Normalize datetime fields to ISO UTC strings with Z suffix for JSON
                try:
                    if activity.get('date') and hasattr(activity.get('date'), 'strftime'):
                        activity['date'] = activity['date'].strftime('%Y-%m-%dT%H:%M:%SZ')
                except Exception:
                    pass
                try:
                    if activity.get('last_synced_at') and hasattr(activity.get('last_synced_at'), 'strftime'):
                        activity['last_synced_at'] = activity['last_synced_at'].strftime('%Y-%m-%dT%H:%M:%SZ')
                except Exception:
                    pass
            
            return activities
        except Exception as e:
            logger.error("get_activity_by_date_range error for uid=%s: %s", uid, e, exc_info=True)
            return []
    
    def get_exercise_sessions(self, uid, start_time, end_time, limit=50):
        """Get exercise sessions"""
        try:
            sessions = list(self.collection.find({
                "uid": uid,
                "activity_type": "exercise",
                "start_time": {"$gte": start_time, "$lte": end_time}
            }).sort("start_time", -1).limit(limit))
            
            # Convert ObjectId to string
            for session in sessions:
                session['_id'] = str(session['_id'])
            
            return sessions
        except Exception as e:
            print(f"Error getting exercise sessions: {e}")
            return []
    
    def get_activity_summary(self, uid, start_date, end_date):
        """Get aggregated activity summary"""
        try:
            from datetime import timezone
            
            # Convert to UTC-aware datetime for MongoDB query
            if not isinstance(start_date, datetime):
                start_date = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            elif start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            
            if not isinstance(end_date, datetime):
                end_date = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
            elif end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            
            pipeline = [
                {
                    "$match": {
                        "uid": uid,
                        "activity_type": "daily",
                        "date": {"$gte": start_date, "$lte": end_date}
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
            
            if result:
                summary = result[0]
                summary.pop('_id', None)
                return summary
            
            return {
                "total_steps": 0,
                "total_distance": 0,
                "total_active_calories": 0,
                "total_calories": 0,
                "avg_steps": 0,
                "days_count": 0
            }
        except Exception as e:
            print(f"Error getting activity summary: {e}")
            return {}