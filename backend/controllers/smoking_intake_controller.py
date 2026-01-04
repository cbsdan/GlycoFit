from flask import request, jsonify
from models.smoking_intake import SmokingIntake
from datetime import datetime
import logging

def save_smoking_intake():
    """
    Save or update smoking intake record
    
    Expected JSON body:
    {
        "smoking_status": "never|former|current",
        "cigarettes_per_day": "0|1-5|6-10|11-20|>20",
        "years_smoked": 0,
        "pack_years": 0,
        "start_date": "2020-01-01" (optional)
    }
    """
    try:
        # Get user_id from request context (set by middleware)
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        data = request.get_json()
        
        # Validate required fields
        if 'smoking_status' not in data:
            return jsonify({
                'success': False,
                'message': 'Smoking status is required'
            }), 400
        
        smoking_status = data['smoking_status']
        
        # Validate smoking status
        if smoking_status not in ['never', 'former', 'current']:
            return jsonify({
                'success': False,
                'message': 'Invalid smoking status. Must be: never, former, or current'
            }), 400
        
        # For non-never smokers, validate additional fields
        if smoking_status != 'never':
            if 'cigarettes_per_day' not in data:
                return jsonify({
                    'success': False,
                    'message': 'Cigarettes per day is required for former/current smokers'
                }), 400
            
            if 'years_smoked' not in data:
                return jsonify({
                    'success': False,
                    'message': 'Years smoked is required for former/current smokers'
                }), 400
            
            cigarettes_per_day = data['cigarettes_per_day']
            
            # Validate cigarettes per day
            if cigarettes_per_day not in ['0', '1-5', '6-10', '11-20', '>20']:
                return jsonify({
                    'success': False,
                    'message': 'Invalid cigarettes per day category'
                }), 400
        else:
            # For never smokers, set defaults
            cigarettes_per_day = '0'
            data['years_smoked'] = 0
            data['pack_years'] = 0
        
        # Validate years_smoked
        try:
            years_smoked = float(data.get('years_smoked', 0))
            if years_smoked < 0:
                return jsonify({
                    'success': False,
                    'message': 'Years smoked cannot be negative'
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'message': 'Invalid years smoked value'
            }), 400
        
        # Validate pack_years
        try:
            pack_years = float(data.get('pack_years', 0))
            if pack_years < 0:
                return jsonify({
                    'success': False,
                    'message': 'Pack years cannot be negative'
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'message': 'Invalid pack years value'
            }), 400
        
        if smoking_status != 'never':
            cigarettes_per_day = data['cigarettes_per_day']
        
        start_date = data.get('start_date')
        
        # Create or update smoking intake record
        smoking_intake = SmokingIntake.create_or_update(
            user_id=user_id,
            smoking_status=smoking_status,
            cigarettes_per_day=cigarettes_per_day,
            years_smoked=years_smoked,
            pack_years=pack_years,
            start_date=start_date
        )
        
        # Calculate risk
        risk_assessment = SmokingIntake.calculate_diabetes_risk(smoking_intake)
        smoking_intake['diabetes_risk'] = risk_assessment
        
        logging.info(f"Smoking intake saved for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Smoking intake saved successfully',
            'data': smoking_intake
        }), 201
        
    except Exception as e:
        logging.error(f"Error saving smoking intake: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to save smoking intake',
            'error': str(e)
        }), 500


def get_smoking_intake():
    """
    Get smoking intake record for the authenticated user
    """
    try:
        # Get user_id from request context
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        # Get smoking intake record
        record = SmokingIntake.find_by_user(user_id)
        
        if not record:
            return jsonify({
                'success': True,
                'data': None,
                'message': 'No smoking intake record found'
            }), 200
        
        # Calculate risk
        risk_assessment = SmokingIntake.calculate_diabetes_risk(record)
        record['diabetes_risk'] = risk_assessment
        
        return jsonify({
            'success': True,
            'data': record
        }), 200
        
    except Exception as e:
        logging.error(f"Error fetching smoking intake: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch smoking intake',
            'error': str(e)
        }), 500


def get_smoking_intake_history():
    """
    Get smoking intake record with session history for the authenticated user
    (Kept for backward compatibility - returns single record with sessions)
    """
    try:
        # Get user_id from request context
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        # Get smoking intake record
        record = SmokingIntake.find_by_user(user_id)
        
        if not record:
            return jsonify({
                'success': True,
                'data': [],
                'total': 0
            }), 200
        
        # Calculate risk
        risk_assessment = SmokingIntake.calculate_diabetes_risk(record)
        record['diabetes_risk'] = risk_assessment
        
        # Return as array for backward compatibility
        return jsonify({
            'success': True,
            'data': [record],
            'total': 1
        }), 200
        
    except Exception as e:
        logging.error(f"Error fetching smoking intake history: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch smoking intake history',
            'error': str(e)
        }), 500


def get_latest_smoking_intake():
    """
    Get the smoking intake record for the authenticated user
    (Returns the single record - equivalent to get_smoking_intake)
    """
    return get_smoking_intake()


def get_smoking_statistics():
    """
    Get smoking intake statistics with diabetes risk for the authenticated user
    """
    try:
        # Get user_id from request context
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        # Get record
        record = SmokingIntake.find_by_user(user_id)
        
        if not record:
            return jsonify({
                'success': True,
                'data': {
                    'has_data': False,
                    'current_status': 'never',
                    'cumulative_pack_years': 0,
                    'total_sessions': 0,
                    'diabetes_risk': {
                        'risk_level': 'low',
                        'risk_score': 1,
                        'explanation': 'No smoking data - minimal risk'
                    }
                }
            }), 200
        
        # Calculate risk
        risk_assessment = SmokingIntake.calculate_diabetes_risk(record)
        
        statistics = {
            'has_data': True,
            'current_status': record.get('current_status'),
            'cumulative_pack_years': record.get('cumulative_pack_years', 0),
            'years_since_quit': record.get('years_since_quit'),
            'total_sessions': len(record.get('smoking_sessions', [])),
            'last_updated': record.get('updated_at'),
            'diabetes_risk': risk_assessment
        }
        
        return jsonify({
            'success': True,
            'data': statistics
        }), 200
        
    except Exception as e:
        logging.error(f"Error fetching smoking statistics: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch smoking statistics',
            'error': str(e)
        }), 500


def delete_smoking_intake():
    """
    Delete entire smoking intake record for the authenticated user
    """
    try:
        # Get user_id from request context
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        # Delete the record
        deleted = SmokingIntake.delete_by_user(user_id)
        
        if deleted:
            logging.info(f"Smoking intake record deleted for user {user_id}")
            return jsonify({
                'success': True,
                'message': 'Smoking intake record deleted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'No smoking intake record found to delete'
            }), 404
        
    except Exception as e:
        logging.error(f"Error deleting smoking intake record: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to delete smoking intake record',
            'error': str(e)
        }), 500


def delete_smoking_session(session_id):
    """
    Delete a specific smoking session
    
    Args:
        session_id (str): Session ID to delete
    """
    try:
        # Get user_id from request context
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        # Delete the session
        deleted = SmokingIntake.delete_session(user_id, session_id)
        
        if deleted:
            logging.info(f"Smoking session {session_id} deleted for user {user_id}")
            return jsonify({
                'success': True,
                'message': 'Smoking session deleted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Session not found'
            }), 404
        
    except Exception as e:
        logging.error(f"Error deleting smoking session: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to delete smoking session',
            'error': str(e)
        }), 500
