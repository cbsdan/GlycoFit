"""
Step Tracking Models for Prediabetes and Type 2 Diabetes Risk Assessment

Data Sources:
- manual_baseline: Required at onboarding (usual activity pattern)
- user_activity: Daily step records from Health Connect or manual entry

Risk Logic (study-based):
- Low activity (<5000 steps/day) increases insulin resistance
- Sedentary behavior increases diabetes risk
- Inconsistent activity patterns increase metabolic risk
- Optimal activity: 7000-10000+ steps/day with regular consistency
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from config.database import get_db
from bson import ObjectId
import logging


class StepBaseline:
    """
    Manual baseline step input - REQUIRED at onboarding.
    Represents user's usual activity pattern.
    
    Fields:
    - user_id: Reference to user
    - baseline_avg_daily_steps: Average daily steps (e.g., 5000)
    - baseline_activity_level: Activity level (sedentary/lightly_active/moderately_active/very_active/extremely_active)
    - baseline_days_active_per_week: Days active per week (0-7)
    - baseline_exercise_minutes_per_week: Exercise minutes per week
    - baseline_work_type: Work type (desk/standing/active/physical)
    - created_at: Timestamp when baseline was created
    - updated_at: Timestamp when baseline was updated
    """
    
    COLLECTION_NAME = "step_baselines"
    
    def __init__(
        self,
        user_id: str,
        baseline_avg_daily_steps: int,
        baseline_activity_level: str,
        baseline_days_active_per_week: int,
        baseline_exercise_minutes_per_week: int,
        baseline_work_type: str,
        created_at: datetime = None,
        updated_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.baseline_avg_daily_steps = baseline_avg_daily_steps
        self.baseline_activity_level = baseline_activity_level
        self.baseline_days_active_per_week = baseline_days_active_per_week
        self.baseline_exercise_minutes_per_week = baseline_exercise_minutes_per_week
        self.baseline_work_type = baseline_work_type
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "baseline_avg_daily_steps": self.baseline_avg_daily_steps,
            "baseline_activity_level": self.baseline_activity_level,
            "baseline_days_active_per_week": self.baseline_days_active_per_week,
            "baseline_exercise_minutes_per_week": self.baseline_exercise_minutes_per_week,
            "baseline_work_type": self.baseline_work_type,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'StepBaseline':
        """Create instance from MongoDB document"""
        return cls(
            _id=data.get("_id"),
            user_id=data.get("user_id"),
            baseline_avg_daily_steps=data.get("baseline_avg_daily_steps"),
            baseline_activity_level=data.get("baseline_activity_level"),
            baseline_days_active_per_week=data.get("baseline_days_active_per_week"),
            baseline_exercise_minutes_per_week=data.get("baseline_exercise_minutes_per_week"),
            baseline_work_type=data.get("baseline_work_type"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at")
        )
    
    def save(self) -> 'StepBaseline':
        """Save baseline to database (create or update)"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        # Check if baseline already exists for this user
        existing = collection.find_one({"user_id": self.user_id})
        if existing:
            # Update existing baseline
            self.updated_at = datetime.utcnow()
            update_data = self.to_dict()
            update_data.pop('created_at', None)  # Don't update created_at
            collection.update_one(
                {"user_id": self.user_id},
                {"$set": update_data}
            )
            self._id = existing["_id"]
            logging.info(f"Updated step baseline for user {self.user_id}")
        else:
            # Create new baseline
            result = collection.insert_one(self.to_dict())
            self._id = result.inserted_id
            logging.info(f"Created step baseline for user {self.user_id}")
        
        return self
    
    @classmethod
    def find_by_user_id(cls, user_id: str) -> Optional['StepBaseline']:
        """Find baseline by user ID"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]

        # Try multiple id formats to be resilient to stored formats
        data = collection.find_one({"user_id": user_id})
        if not data:
            data = collection.find_one({"user_id": str(user_id)})
        if not data:
            try:
                data = collection.find_one({"user_id": ObjectId(user_id)})
            except Exception:
                data = None

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


class StepMetrics:
    """
    Computed step metrics derived from user_activity records and baseline.
    This is a computed/cached document that can be regenerated.
    
    Derived metrics:
    - avg_steps_7d: Average steps over last 7 days
    - avg_steps_30d: Average steps over last 30 days
    - active_days_7d: Days with activity data in last 7 days
    - active_days_30d: Days with activity data in last 30 days
    - step_variability_30d: Standard deviation of steps
    - days_met_goal_7d: Days reached 10k steps in last 7 days
    - days_met_goal_30d: Days reached 10k steps in last 30 days
    - risk_category: Computed step-related diabetes risk
    - risk_factors: List of identified risk factors
    """
    
    COLLECTION_NAME = "step_metrics"
    
    def __init__(
        self,
        user_id: str,
        avg_steps_7d: float = None,
        avg_steps_30d: float = None,
        active_days_7d: int = 0,
        active_days_30d: int = 0,
        step_variability_30d: float = None,
        days_met_goal_7d: int = 0,
        days_met_goal_30d: int = 0,
        dominant_source: str = None,
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
        self.avg_steps_7d = avg_steps_7d
        self.avg_steps_30d = avg_steps_30d
        self.active_days_7d = active_days_7d
        self.active_days_30d = active_days_30d
        self.step_variability_30d = step_variability_30d
        self.days_met_goal_7d = days_met_goal_7d
        self.days_met_goal_30d = days_met_goal_30d
        self.dominant_source = dominant_source
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
            "avg_steps_7d": self.avg_steps_7d,
            "avg_steps_30d": self.avg_steps_30d,
            "active_days_7d": self.active_days_7d,
            "active_days_30d": self.active_days_30d,
            "step_variability_30d": self.step_variability_30d,
            "days_met_goal_7d": self.days_met_goal_7d,
            "days_met_goal_30d": self.days_met_goal_30d,
            "dominant_source": self.dominant_source,
            "days_with_data_7d": self.days_with_data_7d,
            "days_with_data_30d": self.days_with_data_30d,
            "risk_category": self.risk_category,
            "risk_factors": self.risk_factors,
            "risk_score": self.risk_score,
            "computed_at": self.computed_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'StepMetrics':
        """Create instance from MongoDB document"""
        return cls(
            _id=data.get("_id"),
            user_id=data.get("user_id"),
            avg_steps_7d=data.get("avg_steps_7d"),
            avg_steps_30d=data.get("avg_steps_30d"),
            active_days_7d=data.get("active_days_7d"),
            active_days_30d=data.get("active_days_30d"),
            step_variability_30d=data.get("step_variability_30d"),
            days_met_goal_7d=data.get("days_met_goal_7d"),
            days_met_goal_30d=data.get("days_met_goal_30d"),
            dominant_source=data.get("dominant_source"),
            days_with_data_7d=data.get("days_with_data_7d"),
            days_with_data_30d=data.get("days_with_data_30d"),
            risk_category=data.get("risk_category"),
            risk_factors=data.get("risk_factors"),
            risk_score=data.get("risk_score"),
            computed_at=data.get("computed_at")
        )
    
    def save(self) -> 'StepMetrics':
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
        
        logging.info(f"Saved step metrics for user {self.user_id}")
        return self
    
    @classmethod
    def find_by_user_id(cls, user_id: str) -> Optional['StepMetrics']:
        """Find metrics by user ID"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]

        data = collection.find_one({"user_id": user_id})
        if not data:
            data = collection.find_one({"user_id": str(user_id)})
        if not data:
            try:
                data = collection.find_one({"user_id": ObjectId(user_id)})
            except Exception:
                data = None

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


class StepRiskAssessment:
    """
    Historical step risk assessments for tracking risk over time.
    
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
    
    COLLECTION_NAME = "step_risk_assessments"
    
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
    def from_dict(cls, data: Dict[str, Any]) -> 'StepRiskAssessment':
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
    
    def save(self) -> 'StepRiskAssessment':
        """Save assessment to database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        # Upsert by user_id and assessment_date
        collection.update_one(
            {"user_id": self.user_id, "assessment_date": self.assessment_date},
            {"$set": self.to_dict()},
            upsert=True
        )
        
        logging.info(f"Saved step risk assessment for user {self.user_id}")
        return self
    
    @classmethod
    def find_latest_by_user(cls, user_id: str) -> Optional['StepRiskAssessment']:
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
    def find_history_by_user(cls, user_id: str, limit: int = 30) -> List['StepRiskAssessment']:
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


def ensure_all_step_indexes():
    """Create all indexes for step tracking collections"""
    StepBaseline.ensure_indexes()
    StepMetrics.ensure_indexes()
    StepRiskAssessment.ensure_indexes()
    logging.info("All step tracking indexes created successfully")