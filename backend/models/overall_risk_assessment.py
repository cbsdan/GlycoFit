"""
Overall Diabetes Risk Assessment Model

This model combines multiple risk factors to provide a comprehensive
diabetes risk assessment score with detailed explanations.

Components:
1. Initial ML Assessment (35%)
2. Sleep Tracking (12%)
3. Step Tracking (10%)
4. Smoking Tracking (15%)
5. Alcohol Tracking (8%)
6. Food Intake (13%)
7. BMI (5%)
8. Age (2%)
9. Sex (1%)

Total: 100%
"""

from datetime import datetime
from bson import ObjectId
from typing import Dict, Any, List, Optional
from config.database import get_db
import logging

logger = logging.getLogger(__name__)


class RiskCategory:
    """Risk category classifications"""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class OverallRiskAssessment:
    """
    Overall diabetes risk assessment combining all risk factors.
    
    Fields:
    - user_id: Reference to user
    - overall_risk_score: Total risk score (0-100)
    - overall_risk_category: LOW, MODERATE, HIGH, VERY_HIGH
    - confidence_level: HIGH, MODERATE, LOW, PRELIMINARY
    - component_scores: Dictionary of individual component scores and weights
    - primary_risk_factors: List of top risk contributors
    - protective_factors: List of protective factors
    - key_improvements: Top 3 areas for improvement
    - recommendations: Personalized recommendations
    - explanation: Detailed explanation of risk score
    - data_quality_notes: Notes about data completeness
    - assessment_date: Date of assessment
    - created_at: Timestamp when created
    - updated_at: Timestamp when updated
    """
    
    COLLECTION_NAME = "overall_risk_assessments"
    
    # Component weights (must sum to 1.0)
    COMPONENT_WEIGHTS = {
        'initial_assessment': 0.35,
        'sleep': 0.12,
        'steps': 0.10,
        'smoking': 0.15,
        'alcohol': 0.08,
        'food': 0.13,
        'bmi': 0.05,
        'age': 0.02,
        'sex': 0.01
    }
    
    def __init__(
        self,
        user_id: str,
        overall_risk_score: float,
        overall_risk_category: str,
        confidence_level: str,
        component_scores: Dict[str, Any],
        primary_risk_factors: List[Dict[str, Any]],
        protective_factors: List[Dict[str, Any]],
        key_improvements: List[str],
        recommendations: List[str],
        explanation: str,
        data_quality_notes: str = None,
        assessment_date: str = None,
        created_at: datetime = None,
        updated_at: datetime = None,
        _id: ObjectId = None
    ):
        self._id = _id
        self.user_id = str(user_id)
        self.overall_risk_score = round(float(overall_risk_score), 2)
        self.overall_risk_category = overall_risk_category
        self.confidence_level = confidence_level
        self.component_scores = component_scores
        self.primary_risk_factors = primary_risk_factors
        self.protective_factors = protective_factors
        self.key_improvements = key_improvements
        self.recommendations = recommendations
        self.explanation = explanation
        self.data_quality_notes = data_quality_notes
        self.assessment_date = assessment_date or datetime.utcnow().strftime('%Y-%m-%d')
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            'id': str(self._id) if self._id else None,
            'user_id': self.user_id,
            'overall_risk_score': self.overall_risk_score,
            'overall_risk_category': self.overall_risk_category,
            'confidence_level': self.confidence_level,
            'component_scores': self.component_scores,
            'primary_risk_factors': self.primary_risk_factors,
            'protective_factors': self.protective_factors,
            'key_improvements': self.key_improvements,
            'recommendations': self.recommendations,
            'explanation': self.explanation,
            'data_quality_notes': self.data_quality_notes,
            'assessment_date': self.assessment_date,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OverallRiskAssessment':
        """Create instance from dictionary"""
        return cls(
            user_id=data['user_id'],
            overall_risk_score=data['overall_risk_score'],
            overall_risk_category=data['overall_risk_category'],
            confidence_level=data['confidence_level'],
            component_scores=data['component_scores'],
            primary_risk_factors=data.get('primary_risk_factors', []),
            protective_factors=data.get('protective_factors', []),
            key_improvements=data.get('key_improvements', []),
            recommendations=data.get('recommendations', []),
            explanation=data.get('explanation', ''),
            data_quality_notes=data.get('data_quality_notes'),
            assessment_date=data.get('assessment_date'),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            _id=data.get('_id')
        )
    
    def save(self) -> 'OverallRiskAssessment':
        """Save to database"""
        db = get_db()
        collection = db[self.COLLECTION_NAME]
        
        self.updated_at = datetime.utcnow()
        data = {
            'user_id': self.user_id,
            'overall_risk_score': self.overall_risk_score,
            'overall_risk_category': self.overall_risk_category,
            'confidence_level': self.confidence_level,
            'component_scores': self.component_scores,
            'primary_risk_factors': self.primary_risk_factors,
            'protective_factors': self.protective_factors,
            'key_improvements': self.key_improvements,
            'recommendations': self.recommendations,
            'explanation': self.explanation,
            'data_quality_notes': self.data_quality_notes,
            'assessment_date': self.assessment_date,
            'updated_at': self.updated_at
        }
        
        if self._id:
            # Update existing
            collection.update_one({'_id': self._id}, {'$set': data})
        else:
            # Insert new (upsert by user_id to prevent duplicates)
            data['created_at'] = self.created_at
            result = collection.update_one(
                {'user_id': self.user_id},
                {'$set': data},
                upsert=True
            )
            if result.upserted_id:
                self._id = result.upserted_id
        
        return self
    
    @classmethod
    def find_by_user_id(cls, user_id: str) -> Optional['OverallRiskAssessment']:
        """Get latest assessment for user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        data = collection.find_one({'user_id': str(user_id)})
        return cls.from_dict(data) if data else None
    
    @classmethod
    def get_history(cls, user_id: str, limit: int = 30) -> List['OverallRiskAssessment']:
        """Get assessment history for user"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        results = collection.find({'user_id': str(user_id)}).sort('created_at', -1).limit(limit)
        return [cls.from_dict(doc) for doc in results]
    
    @classmethod
    def exists_for_user(cls, user_id: str) -> bool:
        """Check if user has assessment"""
        db = get_db()
        collection = db[cls.COLLECTION_NAME]
        return collection.count_documents({'user_id': str(user_id)}) > 0
    
    @staticmethod
    def classify_risk_category(score: float) -> str:
        """Classify risk category based on score"""
        if score <= 25:
            return RiskCategory.LOW
        elif score <= 50:
            return RiskCategory.MODERATE
        elif score <= 75:
            return RiskCategory.HIGH
        else:
            return RiskCategory.VERY_HIGH
    
    @staticmethod
    def get_risk_category_info(category: str) -> Dict[str, Any]:
        """Get display information for risk category"""
        info = {
            RiskCategory.LOW: {
                'title': 'Low Risk',
                'color': '#10B981',  # Green
                'icon': 'shield-check',
                'probability': '<10% chance in next 10 years',
                'message': 'Your diabetes risk is low. Continue your healthy habits!',
                'description': 'Low Risk - You have excellent diabetes prevention. Maintain your current healthy lifestyle, including regular physical activity, balanced diet, and periodic health checkups.',
                'actionRequired': 'Minimal',
                'recommendations': [
                    'Maintain your healthy lifestyle habits',
                    'Continue regular physical activity',
                    'Keep a balanced diet rich in fruits and vegetables',
                    'Schedule routine health checkups'
                ]
            },
            RiskCategory.MODERATE: {
                'title': 'Moderate Risk',
                'color': '#F59E0B',  # Yellow/Orange
                'icon': 'alert-circle',
                'probability': '10-30% chance in next 10 years',
                'message': 'Your diabetes risk is moderate. Some lifestyle changes are recommended.',
                'description': 'Moderate Risk - You have identifiable risk factors that increase your diabetes risk. Making lifestyle modifications such as increasing physical activity, improving diet quality, and managing weight can significantly reduce your risk.',
                'actionRequired': 'Recommended',
                'recommendations': [
                    'Consult with a healthcare provider',
                    'Increase physical activity to 150 minutes per week',
                    'Monitor your blood sugar levels regularly',
                    'Consider dietary modifications to reduce sugar intake',
                    'Manage stress through relaxation techniques'
                ]
            },
            RiskCategory.HIGH: {
                'title': 'High Risk',
                'color': '#EF4444',  # Orange/Red
                'icon': 'alert-triangle',
                'probability': '30-60% chance in next 10 years',
                'message': 'Your diabetes risk is high. Immediate lifestyle changes are needed.',
                'description': 'High Risk - You have significant risk factors for developing diabetes. Immediate action is required. Consult with your healthcare provider to develop a comprehensive diabetes prevention plan.',
                'actionRequired': 'Urgent',
                'recommendations': [
                    'Schedule an appointment with a healthcare provider immediately',
                    'Get a comprehensive blood glucose screening',
                    'Work with a dietitian for a personalized meal plan',
                    'Start a supervised exercise program',
                    'Monitor blood pressure and cholesterol levels',
                    'Consider joining a diabetes prevention program'
                ]
            },
            RiskCategory.VERY_HIGH: {
                'title': 'Very High Risk',
                'color': '#DC2626',  # Red
                'icon': 'alert-octagon',
                'probability': '>60% chance in next 10 years',
                'message': 'Your diabetes risk is very high. Urgent medical consultation is recommended.',
                'description': 'Very High Risk - You have severe risk factors and a high likelihood of developing diabetes. Urgent medical intervention and intensive lifestyle modifications are critical to prevent or delay the onset of the disease.',
                'actionRequired': 'Critical',
                'recommendations': [
                    'Seek immediate medical evaluation from your healthcare provider',
                    'Complete comprehensive blood glucose and A1C testing',
                    'Enroll in an intensive diabetes prevention program',
                    'Work with a multidisciplinary team (physician, dietitian, fitness trainer)',
                    'Begin medical treatment if recommended by your provider',
                    'Monitor vital signs and biomarkers frequently',
                    'Address all modifiable risk factors immediately'
                ]
            }
        }
        return info.get(category, info[RiskCategory.MODERATE])


def ensure_overall_risk_indexes():
    """Create database indexes for overall risk assessments"""
    db = get_db()
    collection = db[OverallRiskAssessment.COLLECTION_NAME]
    
    # User ID index (unique to store latest assessment)
    collection.create_index('user_id', unique=True)
    
    # Assessment date index
    collection.create_index('assessment_date')
    
    # Risk category index
    collection.create_index([('overall_risk_category', 1), ('assessment_date', -1)])
    
    # Updated timestamp index
    collection.create_index('updated_at')
    
    logger.info("Overall risk assessment indexes created successfully")
