"""
Alcohol Intake Models for Prediabetes/Type 2 Diabetes Risk Assessment

Data Sources:
- alcohol_baseline: Required at onboarding (usual drinking pattern over past 3 months)
- alcohol_daily_log: User-entered daily consumption records

Risk Logic (evidence-based from epidemiological research):
- Light drinking (≤7 drinks/week, evenly distributed) may show protective effect (J-shaped curve)
- Moderate drinking (7-14 drinks/week) is neutral to slightly elevated risk
- Heavy drinking (>14 drinks/week women, >21 men) increases T2D risk by 40-50%
- Binge drinking (≥4 drinks women, ≥5 men per occasion) significantly increases risk
- Drinking pattern variability increases metabolic dysregulation
- Optimal: ≤1 drink/day with meal, no binge episodes

Standard Drink Definition (14g pure alcohol):
- 12 oz (355ml) Beer (5% ABV)
- 5 oz (148ml) Wine (12% ABV)  
- 1.5 oz (44ml) Spirits (40% ABV)
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from config.database import get_db
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class AlcoholRiskCategory(str, Enum):
    """Alcohol-related diabetes risk categories"""
    NONE = "none"
    LOW = "low"  # Light drinking with potential protective effect
    MODERATE = "moderate"
    HIGH = "high"  # Heavy drinking
    VERY_HIGH = "very_high"  # Binge drinking pattern


class DrinkingPattern(str, Enum):
    """Typical drinking patterns"""
    NONE = "none"
    OCCASIONAL = "occasional"  # <1 day/week
    WEEKENDS = "weekends"  # 1-2 days/week
    REGULAR = "regular"  # 3-5 days/week
    DAILY = "daily"  # 6-7 days/week


class AlcoholBaseline:
    """
    Manual baseline alcohol input - REQUIRED at onboarding.
    Represents user's typical drinking pattern over the past 3 months.
    Can be updated if drinking habits change significantly.
    
    Fields:
    - user_id: Reference to user
    - baseline_drinking_days_per_week: Typical number of drinking days (0-7)
    - baseline_drinks_per_occasion: Average drinks per drinking day (0-20)
    - baseline_binge_frequency_per_month: Binge episodes per month (0-31)
    - drinking_pattern: Enum describing usual pattern
    - years_at_current_pattern: How long at this consumption level (0-50)
    - drinks_with_meals: Whether drinks are typically with food (boolean)
    - created_at: Timestamp when baseline was created
    - updated_at: Timestamp when baseline was last updated
    """
    
    COLLECTION_NAME = "alcohol_baselines"
    
    def __init__(
        self,
        user_id: str,
        baseline_drinking_days_per_week: float,
        baseline_drinks_per_occasion: float,
        baseline_binge_frequency_per_month: int,
        drinking_pattern: str = DrinkingPattern.NONE,
        years_at_current_pattern: int = 0,
        drinks_with_meals: bool = False,
        created_at: datetime = None,
        updated_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = str(user_id)
        self.baseline_drinking_days_per_week = float(baseline_drinking_days_per_week)
        self.baseline_drinks_per_occasion = float(baseline_drinks_per_occasion)
        self.baseline_binge_frequency_per_month = int(baseline_binge_frequency_per_month)
        self.drinking_pattern = drinking_pattern
        self.years_at_current_pattern = int(years_at_current_pattern)
        self.drinks_with_meals = bool(drinks_with_meals)
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': str(self._id) if self._id else None,
            'user_id': self.user_id,
            'baseline_drinking_days_per_week': self.baseline_drinking_days_per_week,
            'baseline_drinks_per_occasion': self.baseline_drinks_per_occasion,
            'baseline_binge_frequency_per_month': self.baseline_binge_frequency_per_month,
            'baseline_drinks_per_week': round(self.baseline_drinking_days_per_week * self.baseline_drinks_per_occasion, 2),
            'drinking_pattern': self.drinking_pattern,
            'years_at_current_pattern': self.years_at_current_pattern,
            'drinks_with_meals': self.drinks_with_meals,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AlcoholBaseline':
        return cls(
            user_id=data['user_id'],
            baseline_drinking_days_per_week=data['baseline_drinking_days_per_week'],
            baseline_drinks_per_occasion=data['baseline_drinks_per_occasion'],
            baseline_binge_frequency_per_month=data['baseline_binge_frequency_per_month'],
            drinking_pattern=data.get('drinking_pattern', DrinkingPattern.NONE),
            years_at_current_pattern=data.get('years_at_current_pattern', 0),
            drinks_with_meals=data.get('drinks_with_meals', False),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            _id=data.get('_id')
        )
    
    def save(self) -> 'AlcoholBaseline':
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        self.updated_at = datetime.utcnow()
        data = {
            'user_id': self.user_id,
            'baseline_drinking_days_per_week': self.baseline_drinking_days_per_week,
            'baseline_drinks_per_occasion': self.baseline_drinks_per_occasion,
            'baseline_binge_frequency_per_month': self.baseline_binge_frequency_per_month,
            'drinking_pattern': self.drinking_pattern,
            'years_at_current_pattern': self.years_at_current_pattern,
            'drinks_with_meals': self.drinks_with_meals,
            'updated_at': self.updated_at
        }
        
        if self._id:
            collection.update_one({'_id': self._id}, {'$set': data})
        else:
            data['created_at'] = self.created_at
            result = collection.insert_one(data)
            self._id = result.inserted_id
        
        return self
    
    @classmethod
    def find_by_user_id(cls, user_id: str) -> Optional['AlcoholBaseline']:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({'user_id': str(user_id)})
        return cls.from_dict(data) if data else None
    
    @classmethod
    def exists_for_user(cls, user_id: str) -> bool:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        return collection.count_documents({'user_id': str(user_id)}) > 0
    
    @classmethod
    def delete_by_user_id(cls, user_id: str) -> bool:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        result = collection.delete_one({'user_id': str(user_id)})
        return result.deleted_count > 0


class AlcoholDailyRecord:
    """
    Daily alcohol consumption records from manual logs.
    Tracks actual daily drinking to compute rolling averages and patterns.
    
    Fields:
    - user_id: Reference to user
    - date: Date of consumption (YYYY-MM-DD)
    - drinks_consumed: Number of standard drinks (0-20)
    - was_binge_episode: Whether it qualified as binge (boolean)
    - drinking_context: meal/social/stress/celebration/other
    - time_of_day: morning/afternoon/evening/night
    - notes: Optional user notes
    - created_at: Timestamp when record was created
    - updated_at: Timestamp when record was last updated
    """
    
    COLLECTION_NAME = "alcohol_daily_records"
    
    VALID_CONTEXTS = ['meal', 'social', 'stress', 'celebration', 'other', 'none']
    VALID_TIMES = ['morning', 'afternoon', 'evening', 'night']
    
    def __init__(
        self,
        user_id: str,
        date: str,  # YYYY-MM-DD
        drinks_consumed: float,
        was_binge_episode: bool = False,
        drinking_context: str = 'other',
        time_of_day: str = 'evening',
        notes: str = None,
        created_at: datetime = None,
        updated_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = str(user_id)
        self.date = str(date)
        self.drinks_consumed = float(drinks_consumed)
        self.was_binge_episode = bool(was_binge_episode)
        self.drinking_context = drinking_context if drinking_context in self.VALID_CONTEXTS else 'other'
        self.time_of_day = time_of_day if time_of_day in self.VALID_TIMES else 'evening'
        self.notes = notes
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': str(self._id) if self._id else None,
            'user_id': self.user_id,
            'date': self.date,
            'drinks_consumed': self.drinks_consumed,
            'was_binge_episode': self.was_binge_episode,
            'drinking_context': self.drinking_context,
            'time_of_day': self.time_of_day,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AlcoholDailyRecord':
        return cls(
            user_id=data['user_id'],
            date=data['date'],
            drinks_consumed=data['drinks_consumed'],
            was_binge_episode=data.get('was_binge_episode', False),
            drinking_context=data.get('drinking_context', 'other'),
            time_of_day=data.get('time_of_day', 'evening'),
            notes=data.get('notes'),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            _id=data.get('_id')
        )
    
    def save(self) -> 'AlcoholDailyRecord':
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        self.updated_at = datetime.utcnow()
        data = {
            'user_id': self.user_id,
            'date': self.date,
            'drinks_consumed': self.drinks_consumed,
            'was_binge_episode': self.was_binge_episode,
            'drinking_context': self.drinking_context,
            'time_of_day': self.time_of_day,
            'notes': self.notes,
            'updated_at': self.updated_at
        }
        
        if self._id:
            collection.update_one({'_id': self._id}, {'$set': data})
        else:
            data['created_at'] = self.created_at
            # Check for existing record on same date
            existing = collection.find_one({'user_id': self.user_id, 'date': self.date})
            if existing:
                # Update instead of insert
                collection.update_one(
                    {'user_id': self.user_id, 'date': self.date},
                    {'$set': data}
                )
                self._id = existing['_id']
            else:
                result = collection.insert_one(data)
                self._id = result.inserted_id
        
        return self
    
    @classmethod
    def find_by_user_and_date(cls, user_id: str, date: str) -> Optional['AlcoholDailyRecord']:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({'user_id': str(user_id), 'date': date})
        return cls.from_dict(data) if data else None
    
    @classmethod
    def find_by_user_date_range(cls, user_id: str, start_date: str = None, end_date: str = None, days: int = 30) -> List['AlcoholDailyRecord']:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        
        query = {'user_id': str(user_id)}
        
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter['$gte'] = start_date
            if end_date:
                date_filter['$lte'] = end_date
            query['date'] = date_filter
        elif days:
            # Calculate date from N days ago
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).strftime('%Y-%m-%d')
            query['date'] = {'$gte': cutoff_date}
        
        results = collection.find(query).sort('date', -1)
        return [cls.from_dict(doc) for doc in results]
    
    @classmethod
    def delete_by_user_and_date(cls, user_id: str, date: str) -> bool:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        result = collection.delete_one({'user_id': str(user_id), 'date': date})
        return result.deleted_count > 0
    
    @classmethod
    def count_by_user(cls, user_id: str, days: int = 30) -> int:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).strftime('%Y-%m-%d')
        return collection.count_documents({
            'user_id': str(user_id),
            'date': {'$gte': cutoff_date}
        })


class AlcoholMetrics:
    """
    Computed alcohol metrics derived from daily records and baseline.
    This is a computed/cached document that can be regenerated.
    
    Derived metrics:
    - avg_drinks_per_week_7d: Average weekly consumption over last 7 days
    - avg_drinks_per_week_30d: Average weekly consumption over last 30 days
    - drinking_days_7d: Number of drinking days in last 7 days
    - drinking_days_30d: Number of drinking days in last 30 days
    - binge_episodes_30d: Number of binge episodes in last 30 days
    - consumption_variability_30d: Standard deviation of daily drinks
    - primary_drinking_context: Most common drinking context
    - days_with_data_7d: Number of days with logged data in last 7 days
    - days_with_data_30d: Number of days with logged data in last 30 days
    - risk_category: Computed alcohol-related diabetes risk
    - risk_factors: List of identified risk factors
    """
    
    COLLECTION_NAME = "alcohol_metrics"
    
    def __init__(
        self,
        user_id: str,
        avg_drinks_per_week_7d: float = 0.0,
        avg_drinks_per_week_30d: float = 0.0,
        drinking_days_7d: int = 0,
        drinking_days_30d: int = 0,
        binge_episodes_30d: int = 0,
        consumption_variability_30d: float = 0.0,
        primary_drinking_context: str = 'none',
        days_with_data_7d: int = 0,
        days_with_data_30d: int = 0,
        risk_category: str = AlcoholRiskCategory.NONE,
        risk_factors: List[str] = None,
        last_calculated: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = str(user_id)
        self.avg_drinks_per_week_7d = round(avg_drinks_per_week_7d, 2)
        self.avg_drinks_per_week_30d = round(avg_drinks_per_week_30d, 2)
        self.drinking_days_7d = int(drinking_days_7d)
        self.drinking_days_30d = int(drinking_days_30d)
        self.binge_episodes_30d = int(binge_episodes_30d)
        self.consumption_variability_30d = round(consumption_variability_30d, 2)
        self.primary_drinking_context = primary_drinking_context
        self.days_with_data_7d = int(days_with_data_7d)
        self.days_with_data_30d = int(days_with_data_30d)
        self.risk_category = risk_category
        self.risk_factors = risk_factors or []
        self.last_calculated = last_calculated or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': str(self._id) if self._id else None,
            'user_id': self.user_id,
            'avg_drinks_per_week_7d': self.avg_drinks_per_week_7d,
            'avg_drinks_per_week_30d': self.avg_drinks_per_week_30d,
            'drinking_days_7d': self.drinking_days_7d,
            'drinking_days_30d': self.drinking_days_30d,
            'binge_episodes_30d': self.binge_episodes_30d,
            'consumption_variability_30d': self.consumption_variability_30d,
            'primary_drinking_context': self.primary_drinking_context,
            'days_with_data_7d': self.days_with_data_7d,
            'days_with_data_30d': self.days_with_data_30d,
            'risk_category': self.risk_category,
            'risk_factors': self.risk_factors,
            'last_calculated': self.last_calculated.isoformat() if self.last_calculated else None
        }
    
    @classmethod
    def compute_for_user(cls, user_id: str, user_gender: str = None) -> 'AlcoholMetrics':
        """
        Compute metrics from daily records for a user.
        
        Args:
            user_id: User ID
            user_gender: User gender for risk calculation ('male' or 'female')
        
        Returns:
            AlcoholMetrics instance with computed values
        """
        # Get daily records
        records_7d = AlcoholDailyRecord.find_by_user_date_range(user_id, days=7)
        records_30d = AlcoholDailyRecord.find_by_user_date_range(user_id, days=30)
        
        # Calculate 7-day metrics
        total_drinks_7d = sum(r.drinks_consumed for r in records_7d)
        drinking_days_7d = len([r for r in records_7d if r.drinks_consumed > 0])
        days_with_data_7d = len(records_7d)
        avg_drinks_per_week_7d = total_drinks_7d if days_with_data_7d >= 7 else (total_drinks_7d / max(days_with_data_7d, 1)) * 7
        
        # Calculate 30-day metrics
        total_drinks_30d = sum(r.drinks_consumed for r in records_30d)
        drinking_days_30d = len([r for r in records_30d if r.drinks_consumed > 0])
        days_with_data_30d = len(records_30d)
        avg_drinks_per_week_30d = (total_drinks_30d / max(days_with_data_30d, 1)) * 7
        
        # Binge episodes
        binge_threshold = 4 if user_gender == 'female' else 5
        binge_episodes_30d = len([r for r in records_30d if r.drinks_consumed >= binge_threshold])
        
        # Consumption variability (standard deviation)
        import statistics
        if len(records_30d) > 1:
            drinks_list = [r.drinks_consumed for r in records_30d]
            consumption_variability_30d = statistics.stdev(drinks_list)
        else:
            consumption_variability_30d = 0.0
        
        # Primary drinking context
        contexts = [r.drinking_context for r in records_30d if r.drinks_consumed > 0]
        if contexts:
            from collections import Counter
            primary_drinking_context = Counter(contexts).most_common(1)[0][0]
        else:
            primary_drinking_context = 'none'
        
        # Calculate risk category
        risk_category, risk_factors = cls._calculate_risk(
            avg_drinks_per_week_30d,
            binge_episodes_30d,
            consumption_variability_30d,
            drinking_days_30d,
            user_gender
        )
        
        return cls(
            user_id=user_id,
            avg_drinks_per_week_7d=avg_drinks_per_week_7d,
            avg_drinks_per_week_30d=avg_drinks_per_week_30d,
            drinking_days_7d=drinking_days_7d,
            drinking_days_30d=drinking_days_30d,
            binge_episodes_30d=binge_episodes_30d,
            consumption_variability_30d=consumption_variability_30d,
            primary_drinking_context=primary_drinking_context,
            days_with_data_7d=days_with_data_7d,
            days_with_data_30d=days_with_data_30d,
            risk_category=risk_category,
            risk_factors=risk_factors
        )
    
    @staticmethod
    def _calculate_risk(avg_drinks_per_week: float, binge_episodes: int, variability: float, drinking_days: int, user_gender: str = None) -> tuple:
        """Calculate risk category and factors based on evidence-based thresholds"""
        risk_factors = []
        
        # Binge drinking is highest risk
        if binge_episodes >= 4:
            risk_factors.append(f"Frequent binge drinking ({binge_episodes} episodes in 30 days)")
            return AlcoholRiskCategory.VERY_HIGH, risk_factors
        elif binge_episodes >= 1:
            risk_factors.append(f"Binge drinking episodes ({binge_episodes} in 30 days)")
            return AlcoholRiskCategory.VERY_HIGH, risk_factors
        
        # No consumption
        if avg_drinks_per_week == 0:
            return AlcoholRiskCategory.NONE, ['No alcohol consumption']
        
        # Gender-specific thresholds
        heavy_threshold = 7 if user_gender == 'female' else 14
        
        # Heavy drinking
        if avg_drinks_per_week > heavy_threshold:
            risk_factors.append(f"Heavy drinking ({avg_drinks_per_week:.1f} drinks/week)")
            if variability > 3.0:
                risk_factors.append(f"High consumption variability (SD: {variability:.1f})")
            return AlcoholRiskCategory.HIGH, risk_factors
        
        # Moderate drinking
        if avg_drinks_per_week > 7:
            risk_factors.append(f"Moderate drinking ({avg_drinks_per_week:.1f} drinks/week)")
            if variability > 2.0:
                risk_factors.append(f"Moderate consumption variability (SD: {variability:.1f})")
            return AlcoholRiskCategory.MODERATE, risk_factors
        
        # Light drinking (potentially protective)
        if avg_drinks_per_week <= 7:
            risk_factors.append(f"Light drinking ({avg_drinks_per_week:.1f} drinks/week)")
            if drinking_days >= 5:
                risk_factors.append("Regular drinking pattern (evenly distributed)")
            return AlcoholRiskCategory.LOW, risk_factors
        
        return AlcoholRiskCategory.NONE, ['Insufficient data']
    
    def save(self) -> 'AlcoholMetrics':
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        data = {
            'user_id': self.user_id,
            'avg_drinks_per_week_7d': self.avg_drinks_per_week_7d,
            'avg_drinks_per_week_30d': self.avg_drinks_per_week_30d,
            'drinking_days_7d': self.drinking_days_7d,
            'drinking_days_30d': self.drinking_days_30d,
            'binge_episodes_30d': self.binge_episodes_30d,
            'consumption_variability_30d': self.consumption_variability_30d,
            'primary_drinking_context': self.primary_drinking_context,
            'days_with_data_7d': self.days_with_data_7d,
            'days_with_data_30d': self.days_with_data_30d,
            'risk_category': self.risk_category,
            'risk_factors': self.risk_factors,
            'last_calculated': self.last_calculated
        }
        
        result = collection.update_one(
            {'user_id': self.user_id},
            {'$set': data},
            upsert=True
        )
        
        if not self._id and result.upserted_id:
            self._id = result.upserted_id
        
        return self
    
    @classmethod
    def find_by_user_id(cls, user_id: str) -> Optional['AlcoholMetrics']:
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({'user_id': str(user_id)})
        
        if not data:
            return None
        
        return cls(
            user_id=data['user_id'],
            avg_drinks_per_week_7d=data.get('avg_drinks_per_week_7d', 0.0),
            avg_drinks_per_week_30d=data.get('avg_drinks_per_week_30d', 0.0),
            drinking_days_7d=data.get('drinking_days_7d', 0),
            drinking_days_30d=data.get('drinking_days_30d', 0),
            binge_episodes_30d=data.get('binge_episodes_30d', 0),
            consumption_variability_30d=data.get('consumption_variability_30d', 0.0),
            primary_drinking_context=data.get('primary_drinking_context', 'none'),
            days_with_data_7d=data.get('days_with_data_7d', 0),
            days_with_data_30d=data.get('days_with_data_30d', 0),
            risk_category=data.get('risk_category', AlcoholRiskCategory.NONE),
            risk_factors=data.get('risk_factors', []),
            last_calculated=data.get('last_calculated'),
            _id=data.get('_id')
        )


class AlcoholRiskAssessment:
    """
    Risk assessment combining baseline and actual consumption data.
    Provides comprehensive diabetes risk evaluation.
    """
    
    COLLECTION_NAME = "alcohol_risk_assessments"
    
    @staticmethod
    def generate_assessment(user_id: str, user_gender: str = None) -> Dict[str, Any]:
        """
        Generate comprehensive risk assessment for a user.
        
        Args:
            user_id: User ID
            user_gender: User gender for thresholds
        
        Returns:
            Dict with risk assessment details
        """
        baseline = AlcoholBaseline.find_by_user_id(user_id)
        metrics = AlcoholMetrics.find_by_user_id(user_id)
        
        # If no data, return empty assessment
        if not baseline and not metrics:
            return {
                'has_baseline': False,
                'has_daily_data': False,
                'risk_category': AlcoholRiskCategory.NONE,
                'risk_score': 0,
                'risk_multiplier': 1.0,
                'recommendations': ['Complete baseline assessment to track alcohol consumption']
            }
        
        # Use metrics if available, otherwise baseline
        if metrics and metrics.days_with_data_30d >= 7:
            drinks_per_week = metrics.avg_drinks_per_week_30d
            binge_episodes = metrics.binge_episodes_30d
            risk_category = metrics.risk_category
            risk_factors = metrics.risk_factors
            data_source = 'daily_tracking'
        elif baseline:
            drinks_per_week = baseline.baseline_drinking_days_per_week * baseline.baseline_drinks_per_occasion
            binge_episodes = baseline.baseline_binge_frequency_per_month
            risk_category, risk_factors = AlcoholMetrics._calculate_risk(
                drinks_per_week, binge_episodes, 0.0, baseline.baseline_drinking_days_per_week, user_gender
            )
            data_source = 'baseline'
        else:
            return {
                'has_baseline': False,
                'has_daily_data': False,
                'risk_category': AlcoholRiskCategory.NONE,
                'risk_score': 0,
                'risk_multiplier': 1.0,
                'recommendations': ['Complete baseline assessment']
            }
        
        # Calculate risk score based on category
        risk_scores = {
            AlcoholRiskCategory.NONE: {'score': 0, 'multiplier': 1.0, 'explanation': 'No alcohol consumption - neutral diabetes risk'},
            AlcoholRiskCategory.LOW: {'score': -5, 'multiplier': 0.92, 'explanation': 'Light drinking may have slight protective effect (8% risk reduction)'},
            AlcoholRiskCategory.MODERATE: {'score': 5, 'multiplier': 1.05, 'explanation': 'Moderate drinking - slightly elevated diabetes risk (+5%)'},
            AlcoholRiskCategory.HIGH: {'score': 15, 'multiplier': 1.43, 'explanation': 'Heavy drinking increases diabetes risk by ~43%'},
            AlcoholRiskCategory.VERY_HIGH: {'score': 20, 'multiplier': 1.58, 'explanation': 'Binge drinking significantly increases diabetes risk (+58%)'}
        }
        
        risk_info = risk_scores.get(risk_category, risk_scores[AlcoholRiskCategory.NONE])
        
        # Generate recommendations
        recommendations = AlcoholRiskAssessment._generate_recommendations(
            risk_category, drinks_per_week, binge_episodes, baseline
        )
        
        return {
            'has_baseline': baseline is not None,
            'has_daily_data': metrics is not None and metrics.days_with_data_30d > 0,
            'data_source': data_source,
            'risk_category': risk_category,
            'risk_score': risk_info['score'],
            'risk_multiplier': risk_info['multiplier'],
            'risk_explanation': risk_info['explanation'],
            'risk_factors': risk_factors,
            'current_consumption': {
                'drinks_per_week': round(drinks_per_week, 2),
                'binge_episodes_30d': binge_episodes
            },
            'recommendations': recommendations,
            'baseline_data': baseline.to_dict() if baseline else None,
            'metrics_data': metrics.to_dict() if metrics else None
        }
    
    @staticmethod
    def _generate_recommendations(risk_category: str, drinks_per_week: float, binge_episodes: int, baseline: AlcoholBaseline = None) -> List[str]:
        """Generate personalized recommendations based on risk level"""
        recommendations = []
        
        if risk_category == AlcoholRiskCategory.NONE:
            recommendations.append('Excellent! Avoiding alcohol reduces your diabetes risk.')
            recommendations.append('Continue your alcohol-free lifestyle for optimal metabolic health.')
        
        elif risk_category == AlcoholRiskCategory.LOW:
            recommendations.append('Your alcohol consumption is within low-risk limits for diabetes.')
            recommendations.append('Maintain current pattern: ≤1 drink/day, preferably with meals.')
            if baseline and not baseline.drinks_with_meals:
                recommendations.append('Consider drinking only with meals to minimize blood sugar impact.')
            recommendations.append('Avoid increasing consumption or binge drinking episodes.')
        
        elif risk_category == AlcoholRiskCategory.MODERATE:
            recommendations.append('Your alcohol intake is at moderate risk level for diabetes.')
            recommendations.append(f'Consider reducing from {drinks_per_week:.1f} to ≤7 drinks/week.')
            recommendations.append('Spread drinks evenly across the week (avoid clustering on weekends).')
            recommendations.append('Always consume alcohol with food to slow absorption.')
            recommendations.append('Monitor your blood glucose levels regularly.')
        
        elif risk_category == AlcoholRiskCategory.HIGH:
            recommendations.append('⚠️ Heavy drinking significantly increases diabetes risk.')
            recommendations.append(f'Reduce consumption from {drinks_per_week:.1f} to <7 drinks/week.')
            recommendations.append('Consider alcohol-free days to give your body recovery time.')
            recommendations.append('Consult your healthcare provider about your alcohol consumption.')
            recommendations.append('Monitor liver function and blood glucose regularly.')
        
        elif risk_category == AlcoholRiskCategory.VERY_HIGH:
            recommendations.append('⚠️ URGENT: Binge drinking poses serious diabetes and health risks.')
            recommendations.append(f'You had {binge_episodes} binge episodes recently - this must be addressed.')
            recommendations.append('Seek support from a healthcare provider or counselor immediately.')
            recommendations.append('Consider joining a support group (AA, SMART Recovery, etc.).')
            recommendations.append('Avoid situations that trigger binge drinking.')
        
        # General recommendations
        recommendations.append('Stay hydrated by drinking water between alcoholic beverages.')
        recommendations.append('Track your daily consumption to maintain awareness.')
        
        return recommendations


def ensure_all_alcohol_indexes():
    """Create all necessary database indexes for alcohol tracking"""
    db = get_db()
    
    # Baseline indexes
    baselines = db[AlcoholBaseline.COLLECTION_NAME]
    baselines.create_index('user_id', unique=True)
    baselines.create_index('updated_at')
    
    # Daily records indexes
    daily_records = db[AlcoholDailyRecord.COLLECTION_NAME]
    daily_records.create_index([('user_id', 1), ('date', -1)])
    daily_records.create_index('date')
    
    # Metrics indexes
    metrics = db[AlcoholMetrics.COLLECTION_NAME]
    metrics.create_index('user_id', unique=True)
    metrics.create_index([('risk_category', 1), ('last_calculated', -1)])
    
    logger.info("Alcohol tracking indexes created successfully")
