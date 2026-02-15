"""
Smoking Tracking Models for Prediabetes and Type 2 Diabetes Risk Assessment

Data Sources:
- manual_baseline: Required at onboarding (smoking history)
- manual_daily_log: User-entered daily cigarette count per date

Risk Logic (study-based):
- Active smoking increases T2D risk by ~44% (Willi et al., 2007 JAMA)
- Dose-response relationship with pack-years (Pan et al., 2015 Lancet)
- Risk reduction after quitting (Akter et al., 2017)
- Pack-years as strong predictor (Hur et al., 2001 Diabetes Care)
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from config.database import get_db
from bson import ObjectId
import logging


class SmokingStatus(str, Enum):
    """Enum for smoking status"""
    NEVER = "never"
    FORMER = "former"
    CURRENT = "current"


class SmokingRiskCategory(str, Enum):
    """Smoking-related diabetes risk categories"""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class SmokingBaseline:
    """
    Manual baseline smoking input - REQUIRED at onboarding.
    This represents the user's smoking history and must NEVER be overwritten.
    
    Fields:
    - user_id: Reference to user
    - smoking_status: never, former, or current
    - years_smoked: Total years of smoking (for former/current smokers)
    - typical_cigarettes_per_day: Average cigarettes per day during smoking period
    - quit_date: Date when user quit (for former smokers, YYYY-MM-DD)
    - start_smoking_age: Age when started smoking (optional)
    - created_at: Timestamp when baseline was created
    - is_locked: Boolean to prevent overwrites (always True after creation)
    """
    
    COLLECTION_NAME = "smoking_baselines"
    
    def __init__(
        self,
        user_id: str,
        smoking_status: str,
        years_smoked: float = 0,
        typical_cigarettes_per_day: int = 0,
        quit_date: str = None,
        start_smoking_age: int = None,
        created_at: datetime = None,
        is_locked: bool = True,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.smoking_status = smoking_status
        self.years_smoked = years_smoked
        self.typical_cigarettes_per_day = typical_cigarettes_per_day
        self.quit_date = quit_date
        self.start_smoking_age = start_smoking_age
        self.created_at = created_at or datetime.utcnow()
        self.is_locked = is_locked
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "smoking_status": self.smoking_status,
            "years_smoked": self.years_smoked,
            "typical_cigarettes_per_day": self.typical_cigarettes_per_day,
            "quit_date": self.quit_date,
            "start_smoking_age": self.start_smoking_age,
            "created_at": self.created_at,
            "is_locked": self.is_locked
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SmokingBaseline':
        """Create instance from MongoDB document"""
        return cls(
            user_id=data["user_id"],
            smoking_status=data["smoking_status"],
            years_smoked=data.get("years_smoked", 0),
            typical_cigarettes_per_day=data.get("typical_cigarettes_per_day", 0),
            quit_date=data.get("quit_date"),
            start_smoking_age=data.get("start_smoking_age"),
            created_at=data.get("created_at"),
            is_locked=data.get("is_locked", True),
            _id=data.get("_id")
        )
    
    def save(self) -> 'SmokingBaseline':
        """Save baseline to database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        # Check if baseline already exists
        existing = collection.find_one({"user_id": self.user_id})
        
        if existing:
            if existing.get("is_locked", False):
                raise ValueError("Baseline is locked and cannot be modified. Use update_baseline endpoint to retake questionnaire.")
            # Update existing (only if not locked)
            collection.update_one(
                {"user_id": self.user_id},
                {"$set": self.to_dict()}
            )
            self._id = existing["_id"]
        else:
            # Create new
            result = collection.insert_one(self.to_dict())
            self._id = result.inserted_id
        
        return self
    
    @classmethod
    def find_by_user(cls, user_id: str) -> Optional['SmokingBaseline']:
        """Find baseline by user ID"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({"user_id": user_id})
        return cls.from_dict(data) if data else None
    
    @classmethod
    def exists_for_user(cls, user_id: str) -> bool:
        """Check if baseline exists for user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        return collection.count_documents({"user_id": user_id}) > 0


class SmokingDailyRecord:
    """
    Daily smoking records from manual logs.
    Tracks actual cigarettes smoked per day.
    
    Fields:
    - user_id: Reference to user
    - date: Date of smoking record (YYYY-MM-DD)
    - cigarettes_count: Number of cigarettes smoked on this day
    - notes: Optional user notes (e.g., triggers, cravings)
    - created_at: Timestamp when record was created
    - updated_at: Timestamp when record was last updated
    """
    
    COLLECTION_NAME = "smoking_daily_records"
    
    def __init__(
        self,
        user_id: str,
        date: str,  # YYYY-MM-DD format
        cigarettes_count: int,
        notes: str = None,
        created_at: datetime = None,
        updated_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.date = date
        self.cigarettes_count = cigarettes_count
        self.notes = notes
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "date": self.date,
            "cigarettes_count": self.cigarettes_count,
            "notes": self.notes,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SmokingDailyRecord':
        """Create instance from MongoDB document"""
        return cls(
            user_id=data["user_id"],
            date=data["date"],
            cigarettes_count=data["cigarettes_count"],
            notes=data.get("notes"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
            _id=data.get("_id")
        )
    
    def save(self) -> 'SmokingDailyRecord':
        """Save or update daily record (upsert)"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        self.updated_at = datetime.utcnow()
        
        # Upsert: update if exists for this user and date, create if not
        result = collection.update_one(
            {"user_id": self.user_id, "date": self.date},
            {"$set": self.to_dict()},
            upsert=True
        )
        
        if result.upserted_id:
            self._id = result.upserted_id
        elif not self._id:
            existing = collection.find_one({"user_id": self.user_id, "date": self.date})
            if existing:
                self._id = existing["_id"]
        
        return self
    
    @classmethod
    def find_by_user_and_date(cls, user_id: str, date: str) -> Optional['SmokingDailyRecord']:
        """Find record by user ID and date"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({"user_id": user_id, "date": date})
        return cls.from_dict(data) if data else None
    
    @classmethod
    def find_by_user(
        cls,
        user_id: str,
        start_date: str = None,
        end_date: str = None,
        limit: int = None
    ) -> List['SmokingDailyRecord']:
        """Find all records for user with optional date range"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        query = {"user_id": user_id}
        
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query["date"] = date_filter
        
        cursor = collection.find(query).sort("date", -1)
        if limit:
            cursor = cursor.limit(limit)
        
        return [cls.from_dict(data) for data in cursor]
    
    @classmethod
    def delete_by_user_and_date(cls, user_id: str, date: str) -> int:
        """Delete record by user ID and date"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        result = collection.delete_one({"user_id": user_id, "date": date})
        return result.deleted_count


class SmokingMetrics:
    """
    Computed smoking metrics derived from daily records and baseline.
    This is a computed/cached document that can be regenerated.
    
    Derived metrics:
    - avg_cigarettes_7d: Average cigarettes per day over last 7 days
    - avg_cigarettes_30d: Average cigarettes per day over last 30 days
    - cigarette_variability_30d: Standard deviation of daily cigarette count
    - days_with_data_7d: Number of days with data in last 7 days
    - days_with_data_30d: Number of days with data in last 30 days
    - cumulative_pack_years: Calculated pack-years (from baseline + daily tracking)
    - years_since_quit: Years since quitting (for former smokers)
    - current_status: Derived current smoking status
    - risk_category: Computed smoking-related diabetes risk
    - risk_factors: List of identified risk factors
    """
    
    COLLECTION_NAME = "smoking_metrics"
    
    def __init__(
        self,
        user_id: str,
        avg_cigarettes_7d: float = None,
        avg_cigarettes_30d: float = None,
        cigarette_variability_30d: float = None,
        days_with_data_7d: int = 0,
        days_with_data_30d: int = 0,
        cumulative_pack_years: float = 0,
        years_since_quit: float = None,
        current_status: str = None,
        risk_category: str = None,
        risk_factors: List[str] = None,
        risk_score: float = None,
        computed_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.avg_cigarettes_7d = avg_cigarettes_7d
        self.avg_cigarettes_30d = avg_cigarettes_30d
        self.cigarette_variability_30d = cigarette_variability_30d
        self.days_with_data_7d = days_with_data_7d
        self.days_with_data_30d = days_with_data_30d
        self.cumulative_pack_years = cumulative_pack_years
        self.years_since_quit = years_since_quit
        self.current_status = current_status
        self.risk_category = risk_category
        self.risk_factors = risk_factors or []
        self.risk_score = risk_score
        self.computed_at = computed_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage and API responses"""
        return {
            "user_id": self.user_id,
            "avg_cigarettes_7d": self.avg_cigarettes_7d,
            "avg_cigarettes_30d": self.avg_cigarettes_30d,
            "cigarette_variability_30d": self.cigarette_variability_30d,
            "days_with_data_7d": self.days_with_data_7d,
            "days_with_data_30d": self.days_with_data_30d,
            "cumulative_pack_years": self.cumulative_pack_years,
            "pack_years": self.cumulative_pack_years,  # Alias for frontend compatibility
            "years_since_quit": self.years_since_quit,
            "current_status": self.current_status,
            "risk_category": self.risk_category,
            "risk_factors": self.risk_factors,
            "risk_score": self.risk_score,
            "computed_at": self.computed_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SmokingMetrics':
        """Create instance from MongoDB document"""
        return cls(
            user_id=data["user_id"],
            avg_cigarettes_7d=data.get("avg_cigarettes_7d"),
            avg_cigarettes_30d=data.get("avg_cigarettes_30d"),
            cigarette_variability_30d=data.get("cigarette_variability_30d"),
            days_with_data_7d=data.get("days_with_data_7d", 0),
            days_with_data_30d=data.get("days_with_data_30d", 0),
            cumulative_pack_years=data.get("cumulative_pack_years", 0),
            years_since_quit=data.get("years_since_quit"),
            current_status=data.get("current_status"),
            risk_category=data.get("risk_category"),
            risk_factors=data.get("risk_factors", []),
            risk_score=data.get("risk_score"),
            computed_at=data.get("computed_at"),
            _id=data.get("_id")
        )
    
    def save(self) -> 'SmokingMetrics':
        """Save metrics to database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        self.computed_at = datetime.utcnow()
        
        # Upsert: update if exists for this user, create if not
        result = collection.update_one(
            {"user_id": self.user_id},
            {"$set": self.to_dict()},
            upsert=True
        )
        
        if result.upserted_id:
            self._id = result.upserted_id
        
        return self
    
    @classmethod
    def find_by_user(cls, user_id: str) -> Optional['SmokingMetrics']:
        """Find metrics by user ID"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({"user_id": user_id})
        return cls.from_dict(data) if data else None


class SmokingRiskAssessment:
    """
    Smoking-related diabetes risk assessment.
    Stores historical risk assessments over time.
    
    Fields:
    - user_id: Reference to user
    - risk_category: LOW, MODERATE, HIGH, VERY_HIGH
    - risk_score: Numerical risk score (1-5)
    - risk_factors: List of identified risk factors
    - explanation: Detailed explanation of risk
    - recommendations: List of recommendations
    - assessed_at: Timestamp of assessment
    """
    
    COLLECTION_NAME = "smoking_risk_assessments"
    
    def __init__(
        self,
        user_id: str,
        risk_category: str,
        risk_score: float,
        risk_factors: List[str],
        explanation: str,
        recommendations: List[str],
        assessed_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = user_id
        self.risk_category = risk_category
        self.risk_score = risk_score
        self.risk_factors = risk_factors
        self.explanation = explanation
        self.recommendations = recommendations
        self.assessed_at = assessed_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "user_id": self.user_id,
            "risk_category": self.risk_category,
            "risk_score": self.risk_score,
            "risk_factors": self.risk_factors,
            "explanation": self.explanation,
            "recommendations": self.recommendations,
            "assessed_at": self.assessed_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SmokingRiskAssessment':
        """Create instance from MongoDB document"""
        return cls(
            user_id=data["user_id"],
            risk_category=data["risk_category"],
            risk_score=data["risk_score"],
            risk_factors=data["risk_factors"],
            explanation=data["explanation"],
            recommendations=data["recommendations"],
            assessed_at=data.get("assessed_at"),
            _id=data.get("_id")
        )
    
    def save(self) -> 'SmokingRiskAssessment':
        """Save risk assessment to database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        result = collection.insert_one(self.to_dict())
        self._id = result.inserted_id
        
        return self
    
    @classmethod
    def find_latest_by_user(cls, user_id: str) -> Optional['SmokingRiskAssessment']:
        """Find latest risk assessment for user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one(
            {"user_id": user_id},
            sort=[("assessed_at", -1)]
        )
        return cls.from_dict(data) if data else None
    
    @classmethod
    def find_history_by_user(cls, user_id: str, limit: int = 30) -> List['SmokingRiskAssessment']:
        """Find risk assessment history for user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        cursor = collection.find({"user_id": user_id}).sort("assessed_at", -1).limit(limit)
        return [cls.from_dict(data) for data in cursor]


def ensure_all_smoking_indexes():
    """Create all indexes for smoking tracking collections"""
    db = get_db()
    
    # Baseline indexes
    baseline_collection = db[SmokingBaseline.COLLECTION_NAME]
    baseline_collection.create_index("user_id", unique=True)
    
    # Daily records indexes
    daily_collection = db[SmokingDailyRecord.COLLECTION_NAME]
    daily_collection.create_index([("user_id", 1), ("date", -1)])
    daily_collection.create_index([("user_id", 1), ("date", 1)], unique=True)
    
    # Metrics indexes
    metrics_collection = db[SmokingMetrics.COLLECTION_NAME]
    metrics_collection.create_index("user_id", unique=True)
    
    # Risk assessments indexes
    risk_collection = db[SmokingRiskAssessment.COLLECTION_NAME]
    risk_collection.create_index([("user_id", 1), ("assessed_at", -1)])
    
    logging.info("Smoking tracking indexes created successfully")
