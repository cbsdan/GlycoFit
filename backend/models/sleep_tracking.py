"""
Sleep Tracking Models for Prediabetes and Type 2 Diabetes Risk Assessment

Data Sources:
- manual_baseline: Required at onboarding (usual sleep pattern)
- manual_daily_log: User-entered bedtime + sleep duration per date
- health_connect_daily: Objective sleep records from Android Health Connect

Risk Logic (study-based):
- Short sleep (<6h/night) increases insulin resistance
- Long sleep (>9h/night) increases diabetes incidence
- High variability in duration or bedtime increases metabolic risk
- Optimal sleep: 7-8h/night with stable bedtime
"""

from datetime import datetime, time
from typing import Optional, List, Dict, Any
from enum import Enum
from config.database import get_db
from bson import ObjectId
import logging


class SleepSource(str, Enum):
    """Enum for sleep data sources"""
    MANUAL = "manual"
    HEALTH_CONNECT = "health_connect"


class DominantSleepSource(str, Enum):
    """Enum for dominant sleep data source classification"""
    MANUAL_ONLY = "manual_only"
    MIXED = "mixed"
    HEALTH_CONNECT = "health_connect"


class SleepRiskCategory(str, Enum):
    """Sleep-related diabetes risk categories"""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class SleepBaseline:
    """
    Manual baseline sleep input - REQUIRED at onboarding.
    This represents the user's usual sleep pattern and must NEVER be overwritten.
    
    Fields:
    - user_id: Reference to user
    - baseline_avg_sleep_hours: Average hours of sleep per night (e.g., 7.5)
    - baseline_nights_6h_plus_per_week: Number of nights with 6+ hours sleep (0-7)
    - baseline_bedtime_consistency: Self-reported bedtime consistency (1-5 scale)
    - usual_bedtime: Typical bedtime (HH:MM format stored as string)
    - usual_wake_time: Typical wake time (HH:MM format stored as string)
    - created_at: Timestamp when baseline was created
    - is_locked: Boolean to prevent overwrites (always True after creation)
    """
    
    COLLECTION_NAME = "sleep_baselines"
    
    def __init__(
        self,
        user_id: str,
        baseline_avg_sleep_hours: float,
        baseline_nights_6h_plus_per_week: int,
        baseline_bedtime_consistency: int,
        usual_bedtime: str = None,
        usual_wake_time: str = None,
        created_at: datetime = None,
        is_locked: bool = True,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.baseline_avg_sleep_hours = baseline_avg_sleep_hours
        self.baseline_nights_6h_plus_per_week = baseline_nights_6h_plus_per_week
        self.baseline_bedtime_consistency = baseline_bedtime_consistency
        self.usual_bedtime = usual_bedtime
        self.usual_wake_time = usual_wake_time
        self.created_at = created_at or datetime.utcnow()
        self.is_locked = is_locked
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "baseline_avg_sleep_hours": self.baseline_avg_sleep_hours,
            "baseline_nights_6h_plus_per_week": self.baseline_nights_6h_plus_per_week,
            "baseline_bedtime_consistency": self.baseline_bedtime_consistency,
            "usual_bedtime": self.usual_bedtime,
            "usual_wake_time": self.usual_wake_time,
            "created_at": self.created_at,
            "is_locked": self.is_locked
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SleepBaseline':
        """Create instance from MongoDB document"""
        return cls(
            _id=data.get("_id"),
            user_id=data.get("user_id"),
            baseline_avg_sleep_hours=data.get("baseline_avg_sleep_hours"),
            baseline_nights_6h_plus_per_week=data.get("baseline_nights_6h_plus_per_week"),
            baseline_bedtime_consistency=data.get("baseline_bedtime_consistency"),
            usual_bedtime=data.get("usual_bedtime"),
            usual_wake_time=data.get("usual_wake_time"),
            created_at=data.get("created_at"),
            is_locked=data.get("is_locked", True)
        )
    
    def save(self) -> 'SleepBaseline':
        """Save baseline to database (create or update)"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        # Check if baseline already exists for this user
        existing = collection.find_one({"user_id": self.user_id})
        if existing:
            # Update existing baseline
            update_data = self.to_dict()
            update_data.pop('created_at', None)  # Don't update created_at
            collection.update_one(
                {"user_id": self.user_id},
                {"$set": update_data}
            )
            self._id = existing["_id"]
            logging.info(f"Updated sleep baseline for user {self.user_id}")
        else:
            # Create new baseline
            result = collection.insert_one(self.to_dict())
            self._id = result.inserted_id
            logging.info(f"Created sleep baseline for user {self.user_id}")
        
        return self
    
    @classmethod
    def find_by_user_id(cls, user_id: str) -> Optional['SleepBaseline']:
        """Find baseline by user ID"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({"user_id": user_id})
        if data:
            return cls.from_dict(data)
        return None
    
    @classmethod
    def exists_for_user(cls, user_id: str) -> bool:
        """Check if baseline exists for user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        return collection.count_documents({"user_id": user_id}) > 0
    
    @classmethod
    def ensure_indexes(cls):
        """Create database indexes for optimal query performance"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        collection.create_index("user_id", unique=True)
        logging.info(f"Indexes created for {cls.COLLECTION_NAME}")


class SleepDailyRecord:
    """
    Daily sleep records from manual logs or Health Connect.
    Both sources contribute to rolling averages.
    
    Fields:
    - user_id: Reference to user
    - date: Date of sleep record (YYYY-MM-DD)
    - bedtime: Time user went to bed (HH:MM format)
    - wake_time: Time user woke up (HH:MM format, can be derived)
    - sleep_duration_hours: Total sleep duration in hours
    - source: Enum (manual, health_connect)
    - sleep_quality: Optional quality rating (1-5 scale)
    - notes: Optional user notes
    - created_at: Timestamp when record was created
    - updated_at: Timestamp when record was last updated
    """
    
    COLLECTION_NAME = "sleep_daily_records"
    
    def __init__(
        self,
        user_id: str,
        date: str,  # YYYY-MM-DD format
        bedtime: str,  # HH:MM format
        sleep_duration_hours: float,
        source: str,
        wake_time: str = None,  # HH:MM format (can be derived)
        sleep_quality: int = None,
        notes: str = None,
        created_at: datetime = None,
        updated_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.date = date
        self.bedtime = bedtime
        self.wake_time = wake_time
        self.sleep_duration_hours = sleep_duration_hours
        self.source = source
        self.sleep_quality = sleep_quality
        self.notes = notes
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "date": self.date,
            "bedtime": self.bedtime,
            "wake_time": self.wake_time,
            "sleep_duration_hours": self.sleep_duration_hours,
            "source": self.source,
            "sleep_quality": self.sleep_quality,
            "notes": self.notes,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SleepDailyRecord':
        """Create instance from MongoDB document"""
        return cls(
            _id=data.get("_id"),
            user_id=data.get("user_id"),
            date=data.get("date"),
            bedtime=data.get("bedtime"),
            wake_time=data.get("wake_time"),
            sleep_duration_hours=data.get("sleep_duration_hours"),
            source=data.get("source"),
            sleep_quality=data.get("sleep_quality"),
            notes=data.get("notes"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at")
        )
    
    def save(self) -> 'SleepDailyRecord':
        """Save or update daily record in database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        # Check if record exists for this user, date, and source
        existing = collection.find_one({
            "user_id": self.user_id,
            "date": self.date,
            "source": self.source
        })
        
        if existing:
            # Update existing record
            self.updated_at = datetime.utcnow()
            update_data = self.to_dict()
            update_data.pop("created_at", None)  # Don't update created_at
            collection.update_one(
                {"_id": existing["_id"]},
                {"$set": update_data}
            )
            self._id = existing["_id"]
            logging.info(f"Updated sleep record for user {self.user_id} on {self.date}")
        else:
            # Insert new record
            result = collection.insert_one(self.to_dict())
            self._id = result.inserted_id
            logging.info(f"Created sleep record for user {self.user_id} on {self.date}")
        
        return self
    
    @classmethod
    def find_by_user_and_date(cls, user_id: str, date: str) -> List['SleepDailyRecord']:
        """Find all records for a user on a specific date"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        records = collection.find({"user_id": user_id, "date": date})
        return [cls.from_dict(r) for r in records]
    
    @classmethod
    def find_by_user_and_date_range(
        cls, 
        user_id: str, 
        start_date: str, 
        end_date: str,
        source: str = None
    ) -> List['SleepDailyRecord']:
        """Find records for a user within a date range"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        query = {
            "user_id": user_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        if source:
            query["source"] = source
        
        records = collection.find(query).sort("date", -1)
        return [cls.from_dict(r) for r in records]
    
    @classmethod
    def find_recent_by_user(cls, user_id: str, days: int = 30) -> List['SleepDailyRecord']:
        """Find recent records for a user (last N days)"""
        from datetime import timedelta
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
        start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        return cls.find_by_user_and_date_range(user_id, start_date, end_date)
    
    @classmethod
    def count_by_source(cls, user_id: str, days: int = 30) -> Dict[str, int]:
        """Count records by source for a user in the last N days"""
        from datetime import timedelta
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
        start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        pipeline = [
            {
                "$match": {
                    "user_id": user_id,
                    "date": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$group": {
                    "_id": "$source",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        results = list(collection.aggregate(pipeline))
        return {r["_id"]: r["count"] for r in results}
    
    @classmethod
    def delete_by_user_and_date(cls, user_id: str, date: str, source: str = None) -> int:
        """Delete records for a user on a specific date"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        query = {"user_id": user_id, "date": date}
        if source:
            query["source"] = source
        
        result = collection.delete_many(query)
        return result.deleted_count
    
    @classmethod
    def remove_duplicates(cls, user_id: str = None):
        """Remove duplicate sleep records, keeping the most recent one for each (user_id, date, source)"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        # Build pipeline to find duplicates
        match_stage = {} if user_id is None else {"user_id": user_id}
        
        pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": {"user_id": "$user_id", "date": "$date", "source": "$source"},
                    "count": {"$sum": 1},
                    "docs": {"$push": {"id": "$_id", "updated_at": "$updated_at"}}
                }
            },
            {"$match": {"count": {"$gt": 1}}}
        ]
        
        duplicates = list(collection.aggregate(pipeline))
        deleted_count = 0
        
        for dup in duplicates:
            # Sort by updated_at descending, keep the first (most recent)
            sorted_docs = sorted(dup["docs"], key=lambda x: x.get("updated_at", datetime.min), reverse=True)
            # Delete all except the first one
            for doc in sorted_docs[1:]:
                collection.delete_one({"_id": doc["id"]})
                deleted_count += 1
        
        logging.info(f"Removed {deleted_count} duplicate sleep records")
        return deleted_count
    
    @classmethod
    def ensure_indexes(cls):
        """Create database indexes for optimal query performance"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        # Compound index for user + date queries
        collection.create_index([("user_id", 1), ("date", -1)])
        
        # Compound index for user + date + source (unique)
        # Drop existing non-unique index if it exists
        try:
            collection.create_index(
                [("user_id", 1), ("date", 1), ("source", 1)],
                unique=True
            )
        except Exception as e:
            # If unique index creation fails due to duplicates, clean them up first
            if "duplicate key" in str(e).lower() or "E11000" in str(e):
                logging.warning("Duplicate records found, cleaning up...")
                cls.remove_duplicates()
                # Try creating index again
                collection.create_index(
                    [("user_id", 1), ("date", 1), ("source", 1)],
                    unique=True
                )
            else:
                raise
        
        # Index for date range queries
        collection.create_index("date")
        
        logging.info(f"Indexes created for {cls.COLLECTION_NAME}")


class SleepMetrics:
    """
    Computed sleep metrics derived from daily records and baseline.
    This is a computed/cached document that can be regenerated.
    
    Derived metrics:
    - avg_sleep_7d: Average sleep duration over last 7 days
    - avg_sleep_30d: Average sleep duration over last 30 days
    - bedtime_mean_30d: Average bedtime over last 30 days
    - bedtime_variability_30d: Standard deviation of bedtime (in minutes)
    - sleep_variability_30d: Standard deviation of sleep duration (in hours)
    - dominant_sleep_source: Classification of primary data source
    - days_with_data_7d: Number of days with data in last 7 days
    - days_with_data_30d: Number of days with data in last 30 days
    - risk_category: Computed sleep-related diabetes risk
    - risk_factors: List of identified risk factors
    """
    
    COLLECTION_NAME = "sleep_metrics"
    
    def __init__(
        self,
        user_id: str,
        avg_sleep_7d: float = None,
        avg_sleep_30d: float = None,
        bedtime_mean_30d: str = None,
        bedtime_variability_30d: float = None,
        sleep_variability_30d: float = None,
        dominant_sleep_source: str = None,
        days_with_data_7d: int = 0,
        days_with_data_30d: int = 0,
        risk_category: str = None,
        risk_factors: List[str] = None,
        risk_score: float = None,
        computed_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.avg_sleep_7d = avg_sleep_7d
        self.avg_sleep_30d = avg_sleep_30d
        self.bedtime_mean_30d = bedtime_mean_30d
        self.bedtime_variability_30d = bedtime_variability_30d
        self.sleep_variability_30d = sleep_variability_30d
        self.dominant_sleep_source = dominant_sleep_source
        self.days_with_data_7d = days_with_data_7d
        self.days_with_data_30d = days_with_data_30d
        self.risk_category = risk_category
        self.risk_factors = risk_factors or []
        self.risk_score = risk_score
        self.computed_at = computed_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "avg_sleep_7d": self.avg_sleep_7d,
            "avg_sleep_30d": self.avg_sleep_30d,
            "bedtime_mean_30d": self.bedtime_mean_30d,
            "bedtime_variability_30d": self.bedtime_variability_30d,
            "sleep_variability_30d": self.sleep_variability_30d,
            "dominant_sleep_source": self.dominant_sleep_source,
            "days_with_data_7d": self.days_with_data_7d,
            "days_with_data_30d": self.days_with_data_30d,
            "risk_category": self.risk_category,
            "risk_factors": self.risk_factors,
            "risk_score": self.risk_score,
            "computed_at": self.computed_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SleepMetrics':
        """Create instance from MongoDB document"""
        return cls(
            _id=data.get("_id"),
            user_id=data.get("user_id"),
            avg_sleep_7d=data.get("avg_sleep_7d"),
            avg_sleep_30d=data.get("avg_sleep_30d"),
            bedtime_mean_30d=data.get("bedtime_mean_30d"),
            bedtime_variability_30d=data.get("bedtime_variability_30d"),
            sleep_variability_30d=data.get("sleep_variability_30d"),
            dominant_sleep_source=data.get("dominant_sleep_source"),
            days_with_data_7d=data.get("days_with_data_7d"),
            days_with_data_30d=data.get("days_with_data_30d"),
            risk_category=data.get("risk_category"),
            risk_factors=data.get("risk_factors"),
            risk_score=data.get("risk_score"),
            computed_at=data.get("computed_at")
        )
    
    def save(self) -> 'SleepMetrics':
        """Save or update metrics in database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        # Upsert - update if exists, insert if not
        self.computed_at = datetime.utcnow()
        collection.update_one(
            {"user_id": self.user_id},
            {"$set": self.to_dict()},
            upsert=True
        )
        
        logging.info(f"Saved sleep metrics for user {self.user_id}")
        return self
    
    @classmethod
    def find_by_user_id(cls, user_id: str) -> Optional['SleepMetrics']:
        """Find metrics by user ID"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({"user_id": user_id})
        if data:
            return cls.from_dict(data)
        return None
    
    @classmethod
    def ensure_indexes(cls):
        """Create database indexes for optimal query performance"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        collection.create_index("user_id", unique=True)
        logging.info(f"Indexes created for {cls.COLLECTION_NAME}")


class SleepRiskAssessment:
    """
    Historical sleep risk assessments for tracking risk over time.
    
    Fields:
    - user_id: Reference to user
    - assessment_date: Date of assessment
    - risk_category: LOW, MODERATE, HIGH, VERY_HIGH
    - risk_score: Numeric score (0-100)
    - risk_factors: List of identified risk factors
    - recommendations: Personalized recommendations
    - data_quality: Quality indicator based on data availability
    - metrics_snapshot: Snapshot of metrics used for assessment
    """
    
    COLLECTION_NAME = "sleep_risk_assessments"
    
    def __init__(
        self,
        user_id: str,
        assessment_date: str,
        risk_category: str,
        risk_score: float,
        risk_factors: List[str] = None,
        recommendations: List[str] = None,
        data_quality: str = None,
        metrics_snapshot: Dict[str, Any] = None,
        created_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.assessment_date = assessment_date
        self.risk_category = risk_category
        self.risk_score = risk_score
        self.risk_factors = risk_factors or []
        self.recommendations = recommendations or []
        self.data_quality = data_quality
        self.metrics_snapshot = metrics_snapshot or {}
        self.created_at = created_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "assessment_date": self.assessment_date,
            "risk_category": self.risk_category,
            "risk_score": self.risk_score,
            "risk_factors": self.risk_factors,
            "recommendations": self.recommendations,
            "data_quality": self.data_quality,
            "metrics_snapshot": self.metrics_snapshot,
            "created_at": self.created_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SleepRiskAssessment':
        """Create instance from MongoDB document"""
        return cls(
            _id=data.get("_id"),
            user_id=data.get("user_id"),
            assessment_date=data.get("assessment_date"),
            risk_category=data.get("risk_category"),
            risk_score=data.get("risk_score"),
            risk_factors=data.get("risk_factors"),
            recommendations=data.get("recommendations"),
            data_quality=data.get("data_quality"),
            metrics_snapshot=data.get("metrics_snapshot"),
            created_at=data.get("created_at")
        )
    
    def save(self) -> 'SleepRiskAssessment':
        """Save assessment to database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        # Upsert by user_id and assessment_date
        collection.update_one(
            {"user_id": self.user_id, "assessment_date": self.assessment_date},
            {"$set": self.to_dict()},
            upsert=True
        )
        
        logging.info(f"Saved sleep risk assessment for user {self.user_id}")
        return self
    
    @classmethod
    def find_latest_by_user(cls, user_id: str) -> Optional['SleepRiskAssessment']:
        """Find the most recent assessment for a user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one(
            {"user_id": user_id},
            sort=[("assessment_date", -1)]
        )
        if data:
            return cls.from_dict(data)
        return None
    
    @classmethod
    def find_history_by_user(cls, user_id: str, limit: int = 30) -> List['SleepRiskAssessment']:
        """Find assessment history for a user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        records = collection.find(
            {"user_id": user_id}
        ).sort("assessment_date", -1).limit(limit)
        return [cls.from_dict(r) for r in records]
    
    @classmethod
    def ensure_indexes(cls):
        """Create database indexes for optimal query performance"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        # Compound index for user + date queries
        collection.create_index([("user_id", 1), ("assessment_date", -1)])
        
        # Unique constraint for one assessment per user per date
        collection.create_index(
            [("user_id", 1), ("assessment_date", 1)],
            unique=True
        )
        
        logging.info(f"Indexes created for {cls.COLLECTION_NAME}")


def ensure_all_sleep_indexes():
    """Create all indexes for sleep tracking collections"""
    SleepBaseline.ensure_indexes()
    SleepDailyRecord.ensure_indexes()
    SleepMetrics.ensure_indexes()
    SleepRiskAssessment.ensure_indexes()
    logging.info("All sleep tracking indexes created successfully")
