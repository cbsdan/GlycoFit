"""
Alcohol Intake Model for Prediabetes/Type 2 Diabetes Risk Assessment

This model tracks user alcohol consumption patterns using epidemiology-based metrics
aligned with CDC, NIAAA, and ADA guidelines for diabetes risk assessment.
"""

from datetime import datetime
from bson import ObjectId
from config.database import get_db

class AlcoholIntake:
    """
    Model for tracking alcohol intake data with historical records.
    
    Risk Categories (based on epidemiological guidelines):
    - none: No alcohol consumption
    - light: 1-7 drinks/week (low risk)
    - moderate: 8-14 drinks/week (moderate risk)
    - heavy: >14 drinks/week (high risk for diabetes)
    - binge: Frequent binge drinking (≥4 drinks/occasion for women, ≥5 for men)
    """
    
    COLLECTION_NAME = 'alcohol_intake'
    
    # Risk category thresholds (drinks per week)
    RISK_THRESHOLDS = {
        'none': 0,
        'light': 7,
        'moderate': 14,
        'heavy': float('inf')
    }
    
    # Binge drinking thresholds
    BINGE_THRESHOLD_MALE = 5  # drinks per occasion
    BINGE_THRESHOLD_FEMALE = 4  # drinks per occasion
    BINGE_FREQUENCY_THRESHOLD = 1  # times per month to be considered binge risk
    
    VALID_RISK_CATEGORIES = ['none', 'light', 'moderate', 'heavy', 'binge']
    
    @staticmethod
    def get_collection():
        """Get the alcohol intake collection from database"""
        db = get_db()
        return db[AlcoholIntake.COLLECTION_NAME]
    
    @staticmethod
    def ensure_indexes():
        """Create database indexes for optimal query performance"""
        collection = AlcoholIntake.get_collection()
        # Index on user_id for fast user-specific queries
        collection.create_index('user_id', unique=True)
        # Index on last_updated for time-based queries
        collection.create_index('last_updated')
        # Compound index for risk category analytics
        collection.create_index([('alcohol_risk_category', 1), ('last_updated', -1)])
    
    @staticmethod
    def calculate_drinks_per_week(average_drinks_per_day, drinking_days_per_week):
        """
        Calculate total drinks per week
        
        Args:
            average_drinks_per_day (float): Average drinks consumed per drinking day
            drinking_days_per_week (int): Number of days per week alcohol is consumed
        
        Returns:
            float: Total drinks per week
        """
        if average_drinks_per_day is None or drinking_days_per_week is None:
            return 0.0
        return round(average_drinks_per_day * drinking_days_per_week, 2)
    
    @staticmethod
    def calculate_risk_category(drinks_per_week, binge_frequency_per_month, user_gender=None):
        """
        Calculate alcohol risk category based on consumption patterns.
        
        Evidence-based thresholds from epidemiological research:
        - CDC/NIAAA: Moderate drinking ≤7 drinks/week (women), ≤14 drinks/week (men)
        - ADA: Heavy alcohol consumption increases T2D risk
        - Meta-analyses: Light consumption (≤3/week) shows J-shaped protective curve
        - Binge drinking: Major independent risk factor for diabetes
        
        Thresholds:
        - None: 0 drinks/week
        - Light: ≤3 drinks/week (conservative threshold for health apps)
        - Moderate: Women 4-7, Men 4-14 drinks/week
        - Heavy: Women >7, Men >14 drinks/week
        - Binge: ≥1 episode/month (≥4 drinks for women, ≥5 for men per occasion)
        
        Args:
            drinks_per_week (float): Total weekly alcohol consumption
            binge_frequency_per_month (int): Number of binge drinking episodes per month
            user_gender (str, optional): 'male' or 'female' for gender-specific thresholds
        
        Returns:
            str: Risk category ('none', 'light', 'moderate', 'heavy', 'binge')
        """
        # Binge drinking is highest risk regardless of weekly total
        if binge_frequency_per_month >= AlcoholIntake.BINGE_FREQUENCY_THRESHOLD:
            return 'binge'
        
        # No consumption
        if drinks_per_week == 0:
            return 'none'
        
        # Light consumption: ≤3 drinks/week for everyone (conservative, evidence-based)
        if drinks_per_week <= 3:
            return 'light'
        
        # Apply gender-specific thresholds for moderate and heavy
        if user_gender == 'female':
            # Women: >7 drinks/week is heavy, 4-7 is moderate
            if drinks_per_week > 7:
                return 'heavy'
            else:  # 4-7 drinks/week
                return 'moderate'
        elif user_gender == 'male':
            # Men: >14 drinks/week is heavy, 4-14 is moderate
            if drinks_per_week > 14:
                return 'heavy'
            else:  # 4-14 drinks/week
                return 'moderate'
        else:
            # Gender unknown: use women's thresholds (more conservative)
            if drinks_per_week > 7:
                return 'heavy'
            else:  # 4-7 drinks/week
                return 'moderate'
    
    @staticmethod
    def calculate_diabetes_risk_score(alcohol_risk_category, drinks_per_week):
        """
        Calculate diabetes risk score contribution from alcohol intake.
        
        Based on epidemiological evidence:
        - Moderate drinking (1-2 drinks/day) may have protective effect
        - Heavy drinking (>14 drinks/week) increases diabetes risk by 43%
        - Binge drinking increases risk by 40-60%
        
        Args:
            alcohol_risk_category (str): Risk category
            drinks_per_week (float): Weekly alcohol consumption
        
        Returns:
            dict: Risk score and explanation
        """
        risk_scores = {
            'none': {
                'score': 0,
                'multiplier': 1.0,
                'explanation': 'No alcohol consumption - neutral diabetes risk'
            },
            'light': {
                'score': -5,  # Slight protective effect
                'multiplier': 0.95,
                'explanation': 'Light drinking may have slight protective effect against diabetes'
            },
            'moderate': {
                'score': 0,
                'multiplier': 1.0,
                'explanation': 'Moderate drinking - neutral to slightly elevated risk'
            },
            'heavy': {
                'score': 15,
                'multiplier': 1.43,
                'explanation': 'Heavy drinking increases diabetes risk by ~43%'
            },
            'binge': {
                'score': 20,
                'multiplier': 1.55,
                'explanation': 'Binge drinking pattern significantly increases diabetes risk'
            }
        }
        
        return risk_scores.get(alcohol_risk_category, risk_scores['none'])
    
    @staticmethod
    def validate_data(data):
        """
        Validate alcohol intake data
        
        Args:
            data (dict): Alcohol intake data to validate
        
        Returns:
            tuple: (is_valid, error_message)
        """
        # Check average_drinks_per_day
        if 'average_drinks_per_day' in data:
            avg_drinks = data['average_drinks_per_day']
            if avg_drinks is not None:
                if not isinstance(avg_drinks, (int, float)):
                    return False, "average_drinks_per_day must be a number"
                if avg_drinks < 0:
                    return False, "average_drinks_per_day cannot be negative"
                if avg_drinks > 20:
                    return False, "average_drinks_per_day seems unreasonably high (max 20)"
        
        # Check drinking_days_per_week
        if 'drinking_days_per_week' in data:
            drinking_days = data['drinking_days_per_week']
            if drinking_days is not None:
                if not isinstance(drinking_days, int):
                    return False, "drinking_days_per_week must be an integer"
                if drinking_days < 0 or drinking_days > 7:
                    return False, "drinking_days_per_week must be between 0 and 7"
        
        # Check binge_frequency_per_month
        if 'binge_frequency_per_month' in data:
            binge_freq = data['binge_frequency_per_month']
            if binge_freq is not None:
                if not isinstance(binge_freq, int):
                    return False, "binge_frequency_per_month must be an integer"
                if binge_freq < 0:
                    return False, "binge_frequency_per_month cannot be negative"
                if binge_freq > 31:
                    return False, "binge_frequency_per_month cannot exceed 31"
        
        # Check risk category if provided
        if 'alcohol_risk_category' in data:
            category = data['alcohol_risk_category']
            if category and category not in AlcoholIntake.VALID_RISK_CATEGORIES:
                return False, f"alcohol_risk_category must be one of: {', '.join(AlcoholIntake.VALID_RISK_CATEGORIES)}"
        
        return True, None
    
    @staticmethod
    def create_or_update(user_id, data, user_gender=None):
        """
        Create or update alcohol intake record for a user.
        Maintains historical data by archiving previous records.
        
        Args:
            user_id (str): User ID
            data (dict): Alcohol intake data
            user_gender (str, optional): User gender for risk calculation
        
        Returns:
            dict: Created/updated alcohol intake record
        """
        collection = AlcoholIntake.get_collection()
        
        # Validate input data
        is_valid, error_msg = AlcoholIntake.validate_data(data)
        if not is_valid:
            raise ValueError(error_msg)
        
        # Extract and set defaults for optional fields
        average_drinks_per_day = data.get('average_drinks_per_day', 0.0)
        drinking_days_per_week = data.get('drinking_days_per_week', 0)
        binge_frequency_per_month = data.get('binge_frequency_per_month', 0)
        
        # Calculate derived fields
        drinks_per_week = AlcoholIntake.calculate_drinks_per_week(
            average_drinks_per_day, 
            drinking_days_per_week
        )
        
        alcohol_risk_category = AlcoholIntake.calculate_risk_category(
            drinks_per_week,
            binge_frequency_per_month,
            user_gender
        )
        
        # Get diabetes risk score
        risk_info = AlcoholIntake.calculate_diabetes_risk_score(
            alcohol_risk_category,
            drinks_per_week
        )
        
        now = datetime.utcnow()
        
        # Check if user already has a record
        existing = collection.find_one({'user_id': user_id})
        
        if existing:
            # Update existing record (rewrite previous assessment)
            update_data = {
                '$set': {
                    'average_drinks_per_day': average_drinks_per_day,
                    'drinking_days_per_week': drinking_days_per_week,
                    'drinks_per_week': drinks_per_week,
                    'binge_frequency_per_month': binge_frequency_per_month,
                    'alcohol_risk_category': alcohol_risk_category,
                    'diabetes_risk_score': risk_info['score'],
                    'diabetes_risk_multiplier': risk_info['multiplier'],
                    'risk_explanation': risk_info['explanation'],
                    'last_updated': now
                }
            }
            
            collection.update_one({'user_id': user_id}, update_data)
            result = collection.find_one({'user_id': user_id})
        else:
            # Create new record
            new_record = {
                'user_id': user_id,
                'average_drinks_per_day': average_drinks_per_day,
                'drinking_days_per_week': drinking_days_per_week,
                'drinks_per_week': drinks_per_week,
                'binge_frequency_per_month': binge_frequency_per_month,
                'alcohol_risk_category': alcohol_risk_category,
                'diabetes_risk_score': risk_info['score'],
                'diabetes_risk_multiplier': risk_info['multiplier'],
                'risk_explanation': risk_info['explanation'],
                'created_at': now,
                'last_updated': now
            }
            
            insert_result = collection.insert_one(new_record)
            result = collection.find_one({'_id': insert_result.inserted_id})
        
        return AlcoholIntake._format_document(result)
    
    @staticmethod
    def get_by_user_id(user_id):
        """
        Get alcohol intake record for a specific user
        
        Args:
            user_id (str): User ID
        
        Returns:
            dict or None: Alcohol intake record
        """
        collection = AlcoholIntake.get_collection()
        result = collection.find_one({'user_id': user_id})
        return AlcoholIntake._format_document(result) if result else None
    
    @staticmethod
    def delete_by_user_id(user_id):
        """
        Delete alcohol intake record for a user
        
        Args:
            user_id (str): User ID
        
        Returns:
            bool: True if deleted, False if not found
        """
        collection = AlcoholIntake.get_collection()
        result = collection.delete_one({'user_id': user_id})
        return result.deleted_count > 0
    
    @staticmethod
    def get_statistics(start_date=None, end_date=None):
        """
        Get aggregate statistics on alcohol intake patterns
        
        Args:
            start_date (datetime, optional): Start date for filtering
            end_date (datetime, optional): End date for filtering
        
        Returns:
            dict: Statistics including risk category distribution
        """
        collection = AlcoholIntake.get_collection()
        
        match_query = {}
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter['$gte'] = start_date
            if end_date:
                date_filter['$lte'] = end_date
            match_query['last_updated'] = date_filter
        
        pipeline = [
            {'$match': match_query},
            {
                '$group': {
                    '_id': '$alcohol_risk_category',
                    'count': {'$sum': 1},
                    'avg_drinks_per_week': {'$avg': '$drinks_per_week'},
                    'avg_binge_frequency': {'$avg': '$binge_frequency_per_month'}
                }
            }
        ]
        
        results = list(collection.aggregate(pipeline))
        
        # Format statistics
        stats = {
            'total_users': sum(r['count'] for r in results),
            'by_risk_category': {},
            'overall_averages': {
                'drinks_per_week': 0,
                'binge_frequency': 0
            }
        }
        
        for result in results:
            category = result['_id'] or 'unknown'
            stats['by_risk_category'][category] = {
                'count': result['count'],
                'avg_drinks_per_week': round(result['avg_drinks_per_week'], 2),
                'avg_binge_frequency': round(result['avg_binge_frequency'], 2)
            }
        
        # Calculate overall averages
        if stats['total_users'] > 0:
            total_drinks = sum(
                r['avg_drinks_per_week'] * r['count'] 
                for r in results
            )
            total_binge = sum(
                r['avg_binge_frequency'] * r['count'] 
                for r in results
            )
            stats['overall_averages']['drinks_per_week'] = round(
                total_drinks / stats['total_users'], 2
            )
            stats['overall_averages']['binge_frequency'] = round(
                total_binge / stats['total_users'], 2
            )
        
        return stats
    
    @staticmethod
    def _format_document(doc):
        """
        Format MongoDB document for API response
        
        Args:
            doc (dict): MongoDB document
        
        Returns:
            dict: Formatted document
        """
        if not doc:
            return None
        
        formatted = {
            'id': str(doc['_id']),
            'user_id': doc['user_id'],
            'average_drinks_per_day': doc.get('average_drinks_per_day', 0.0),
            'drinking_days_per_week': doc.get('drinking_days_per_week', 0),
            'drinks_per_week': doc.get('drinks_per_week', 0.0),
            'binge_frequency_per_month': doc.get('binge_frequency_per_month', 0),
            'alcohol_risk_category': doc.get('alcohol_risk_category', 'none'),
            'diabetes_risk_score': doc.get('diabetes_risk_score', 0),
            'diabetes_risk_multiplier': doc.get('diabetes_risk_multiplier', 1.0),
            'risk_explanation': doc.get('risk_explanation', ''),
            'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
            'last_updated': doc.get('last_updated').isoformat() if doc.get('last_updated') else None
        }
        
        return formatted
