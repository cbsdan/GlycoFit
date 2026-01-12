from pymongo import DESCENDING
from bson import ObjectId
from datetime import datetime
from config.database import get_db

def get_smoking_intake_collection():
    """Return the smoking_intake collection from the initialized DB."""
    db = get_db()
    return db.smoking_intake

class SmokingIntake:
    """
    Smoking Intake Model (Session-Based)
    Tracks user smoking history with sessions for accurate cumulative risk assessment
    One record per user with array of smoking sessions
    """
    
    @staticmethod
    def ensure_indexes():
        """Create indexes for the smoking_intake collection"""
        # Index for user_id for efficient queries (one record per user)
        col = get_smoking_intake_collection()
        col.create_index("user_id", unique=True)
        col.create_index("updated_at")
        print("Smoking intake collection indexes created successfully")
    
    @staticmethod
    def create_or_update(user_id, smoking_status, cigarettes_per_day, years_smoked, pack_years, start_date=None):
        """
        Create or update smoking intake record for a user
        
        Args:
            user_id (str): User's ID
            smoking_status (str): 'never', 'former', or 'current'
            cigarettes_per_day (str): '0', '1-5', '6-10', '11-20', '>20'
            years_smoked (float): Number of years for this entry
            pack_years (float): Calculated pack-years for this entry
            start_date (str): ISO date when this smoking session started (optional)
        
        Returns:
            dict: Updated smoking intake record
        """
        col = get_smoking_intake_collection()
        existing_record = col.find_one({'user_id': user_id})
        
        now = datetime.utcnow()
        
        # Create new session entry
        new_session = {
            'session_id': str(ObjectId()),
            'start_date': start_date or now.isoformat(),
            'end_date': None if smoking_status == 'current' else now.isoformat(),
            'cigarettes_per_day': cigarettes_per_day,
            'duration_years': years_smoked,
            'pack_years': pack_years,
            'status': 'active' if smoking_status == 'current' else 'quit',
            'recorded_at': now
        }
        
        if existing_record:
            # Update existing record
            sessions = existing_record.get('smoking_sessions', [])
            
            # Close any active sessions if status changed from current
            if smoking_status != 'current':
                for session in sessions:
                    if session.get('status') == 'active':
                        session['status'] = 'quit'
                        session['end_date'] = now.isoformat()
            
            # If status is never, clear all sessions
            if smoking_status == 'never':
                sessions = []
                cumulative_pack_years = 0
                years_since_quit = None
            else:
                # Add new session
                sessions.append(new_session)
                
                # Calculate cumulative pack-years
                cumulative_pack_years = sum(s.get('pack_years', 0) for s in sessions)
                
                # Calculate years since quit if former smoker
                years_since_quit = None
                if smoking_status == 'former':
                    # Find most recent quit date
                    quit_sessions = [s for s in sessions if s.get('status') == 'quit' and s.get('end_date')]
                    if quit_sessions:
                        most_recent_quit = max(quit_sessions, key=lambda x: x.get('end_date', ''))
                        quit_date = datetime.fromisoformat(most_recent_quit['end_date'].replace('Z', '+00:00'))
                        years_since_quit = (now - quit_date).days / 365.25
            
            # Update record
            result = col.update_one(
                {'user_id': user_id},
                {
                    '$set': {
                        'current_status': smoking_status,
                        'cumulative_pack_years': cumulative_pack_years,
                        'years_since_quit': years_since_quit,
                        'smoking_sessions': sessions,
                        'updated_at': now
                    }
                }
            )
            
            # Fetch and return updated record
            record = col.find_one({'user_id': user_id})
        else:
            # Create new record
            cumulative_pack_years = pack_years if smoking_status != 'never' else 0
            sessions = [new_session] if smoking_status != 'never' else []
            
            record = {
                'user_id': user_id,
                'current_status': smoking_status,
                'cumulative_pack_years': cumulative_pack_years,
                'years_since_quit': None,
                'smoking_sessions': sessions,
                'created_at': now,
                'updated_at': now
            }
            
            result = col.insert_one(record)
            record['_id'] = result.inserted_id
        
        # Convert ObjectId to string
        record['_id'] = str(record['_id'])
        return record
    
    @staticmethod
    def find_by_user(user_id):
        """
        Get smoking intake record for a user
        
        Args:
            user_id (str): User's ID
        
        Returns:
            dict: Smoking intake record or None
        """
        col = get_smoking_intake_collection()
        record = col.find_one({'user_id': user_id})
        
        if record:
            record['_id'] = str(record['_id'])
        
        return record
    
    @staticmethod
    def find_by_id(record_id):
        """
        Find smoking intake record by ID
        
        Args:
            record_id (str): Record ID
        
        Returns:
            dict: Smoking intake record or None
        """
        try:
            col = get_smoking_intake_collection()
            record = col.find_one({'_id': ObjectId(record_id)})
            if record:
                record['_id'] = str(record['_id'])
            return record
        except Exception:
            return None
    
    @staticmethod
    def delete_by_user(user_id):
        """
        Delete smoking intake record for a user
        
        Args:
            user_id (str): User's ID
        
        Returns:
            bool: True if deleted, False otherwise
        """
        col = get_smoking_intake_collection()
        result = col.delete_one({'user_id': user_id})
        return result.deleted_count > 0
    
    @staticmethod
    def delete_session(user_id, session_id):
        """
        Delete a specific smoking session
        
        Args:
            user_id (str): User's ID
            session_id (str): Session ID to delete
        
        Returns:
            bool: True if deleted, False otherwise
        """
        col = get_smoking_intake_collection()
        record = col.find_one({'user_id': user_id})
        if not record:
            return False
        
        sessions = record.get('smoking_sessions', [])
        original_count = len(sessions)
        
        # Remove session
        sessions = [s for s in sessions if s.get('session_id') != session_id]
        
        if len(sessions) == original_count:
            return False  # Session not found
        
        # Recalculate cumulative pack-years
        cumulative_pack_years = sum(s.get('pack_years', 0) for s in sessions)
        
        # Determine current status
        has_active = any(s.get('status') == 'active' for s in sessions)
        current_status = 'current' if has_active else ('former' if sessions else 'never')
        
        # Update record
        col.update_one(
            {'user_id': user_id},
            {
                '$set': {
                    'smoking_sessions': sessions,
                    'cumulative_pack_years': cumulative_pack_years,
                    'current_status': current_status,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return True
    
    @staticmethod
    def calculate_diabetes_risk(record):
        """
        Calculate diabetes risk based on smoking data
        Evidence-based on medical research:
        - Willi et al. (2007) JAMA: Active smokers have 44% increased T2D risk
        - Pan et al. (2015) Lancet: Dose-response with pack-years
        - Akter et al. (2017): Risk reduction after quitting (5-10+ years)
        - Hur et al. (2001) Diabetes Care: Pack-years as predictor
        
        Args:
            record (dict): Smoking intake record
        
        Returns:
            dict: Risk assessment with level and explanation
        """
        if not record:
            return {
                'risk_level': 'unknown',
                'risk_score': 0,
                'explanation': 'No smoking data available'
            }
        
        current_status = record.get('current_status', 'never')
        cumulative_pack_years = record.get('cumulative_pack_years', 0)
        years_since_quit = record.get('years_since_quit')
        
        # Risk calculation based on medical research
        if current_status == 'never':
            return {
                'risk_level': 'low',
                'risk_score': 1,
                'explanation': 'Never smoked - baseline diabetes risk (Reference: Willi et al., 2007)'
            }
        
        elif current_status == 'current':
            # Active smoking increases T2D risk by ~44% (Willi et al., 2007)
            # Dose-response relationship with pack-years (Pan et al., 2015)
            if cumulative_pack_years >= 30:
                return {
                    'risk_level': 'very_high',
                    'risk_score': 5,
                    'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - significantly elevated diabetes risk (>60% increase, Pan et al., 2015)'
                }
            elif cumulative_pack_years >= 20:
                return {
                    'risk_level': 'high',
                    'risk_score': 4,
                    'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - high diabetes risk (~50% increase, Pan et al., 2015)'
                }
            elif cumulative_pack_years >= 10:
                return {
                    'risk_level': 'moderate_high',
                    'risk_score': 3,
                    'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - moderate-high diabetes risk (~40% increase, Willi et al., 2007)'
                }
            elif cumulative_pack_years >= 5:
                return {
                    'risk_level': 'moderate',
                    'risk_score': 3,
                    'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - moderate diabetes risk (~44% baseline increase, Willi et al., 2007)'
                }
            elif cumulative_pack_years >= 1:
                return {
                    'risk_level': 'low_moderate',
                    'risk_score': 2,
                    'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - low-moderate diabetes risk. Consider quitting to prevent risk escalation (Willi et al., 2007)'
                }
            else:
                return {
                    'risk_level': 'low',
                    'risk_score': 1,
                    'explanation': f'Current smoker with minimal exposure ({cumulative_pack_years:.1f} pack-years) - low diabetes risk currently, but quit now to prevent future risk (Willi et al., 2007)'
                }
        
        elif current_status == 'former':
            if years_since_quit is None:
                years_since_quit = 0
            
            # Risk decreases over time after quitting (Akter et al., 2017)
            # Risk approaches baseline after 10+ years
            if years_since_quit >= 10:
                if cumulative_pack_years < 5:
                    return {
                        'risk_level': 'low',
                        'risk_score': 1,
                        'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - minimal exposure and long quit period, risk returned to baseline (Akter et al., 2017)'
                    }
                else:
                    return {
                        'risk_level': 'low_moderate',
                        'risk_score': 2,
                        'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - risk substantially reduced, approaching baseline (Akter et al., 2017)'
                    }
            elif years_since_quit >= 5:
                # Risk reduced by 10-30% after 5 years (Akter et al., 2017)
                if cumulative_pack_years >= 20:
                    return {
                        'risk_level': 'moderate',
                        'risk_score': 3,
                        'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - risk moderately reduced but still elevated due to high cumulative exposure (Akter et al., 2017)'
                    }
                elif cumulative_pack_years >= 5:
                    return {
                        'risk_level': 'low_moderate',
                        'risk_score': 2,
                        'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - risk moderately reduced (Akter et al., 2017)'
                    }
                else:
                    return {
                        'risk_level': 'low',
                        'risk_score': 1,
                        'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - minimal exposure, risk approaching baseline (Akter et al., 2017)'
                    }
            else:
                # Recently quit (<5 years) - risk still elevated
                if cumulative_pack_years >= 20:
                    return {
                        'risk_level': 'high',
                        'risk_score': 4,
                        'explanation': f'Recently quit ({years_since_quit:.1f} years, {cumulative_pack_years:.1f} pack-years) - risk still elevated due to high cumulative exposure, continue healthy lifestyle (Pan et al., 2015)'
                    }
                elif cumulative_pack_years >= 10:
                    return {
                        'risk_level': 'moderate_high',
                        'risk_score': 3,
                        'explanation': f'Recently quit ({years_since_quit:.1f} years, {cumulative_pack_years:.1f} pack-years) - risk gradually decreasing (Akter et al., 2017)'
                    }
                elif cumulative_pack_years >= 5:
                    return {
                        'risk_level': 'moderate',
                        'risk_score': 3,
                        'explanation': f'Recently quit ({years_since_quit:.1f} years, {cumulative_pack_years:.1f} pack-years) - risk decreasing, maintain healthy lifestyle (Akter et al., 2017)'
                    }
                elif cumulative_pack_years >= 1:
                    return {
                        'risk_level': 'low_moderate',
                        'risk_score': 2,
                        'explanation': f'Recently quit ({years_since_quit:.1f} years, {cumulative_pack_years:.1f} pack-years) - low cumulative exposure, risk decreasing rapidly (Akter et al., 2017)'
                    }
                else:
                    return {
                        'risk_level': 'low',
                        'risk_score': 1,
                        'explanation': f'Recently quit ({years_since_quit:.1f} years, {cumulative_pack_years:.1f} pack-years) - minimal exposure, risk approaching baseline (Akter et al., 2017)'
                    }
        
        return {
            'risk_level': 'unknown',
            'risk_score': 0,
            'explanation': 'Unable to calculate risk'
        }
