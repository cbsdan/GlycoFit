"""
Alcohol Intake Controller

Handles HTTP requests for alcohol intake tracking and risk assessment.
"""

from flask import jsonify, request
import logging
from models.alcohol_intake import AlcoholIntake
from models.user import User

logger = logging.getLogger(__name__)


def create_or_update_alcohol_intake():
    """
    Create or update alcohol intake data for authenticated user.
    
    Request Body (all fields optional):
    {
        "average_drinks_per_day": 2.5,
        "drinking_days_per_week": 3,
        "binge_frequency_per_month": 1
    }
    
    Returns:
        JSON response with alcohol intake data and risk assessment
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
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'Request body is required'
            }), 400
        
        # Get user gender for gender-specific risk thresholds
        user_gender = None
        try:
            user = User.find_by_id(user_id)
            if user:
                user_gender = (user.sex or '').lower()
        except Exception as e:
            logger.warning(f"Could not retrieve user gender: {str(e)}")
        
        # Create or update alcohol intake record
        alcohol_intake = AlcoholIntake.create_or_update(user_id, data, user_gender)
        
        logger.info(f"Alcohol intake updated for user {user_id}: {alcohol_intake['alcohol_risk_category']}")
        
        return jsonify({
            'success': True,
            'message': 'Alcohol intake data saved successfully',
            'data': alcohol_intake
        }), 200
        
    except ValueError as e:
        logger.warning(f"Validation error in alcohol intake: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error creating/updating alcohol intake: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to save alcohol intake data'
        }), 500


def get_alcohol_intake():
    """
    Get alcohol intake data for authenticated user.
    
    Returns:
        JSON response with alcohol intake data
    """
    try:
        # Get user_id from request context (set by middleware)
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        alcohol_intake = AlcoholIntake.get_by_user_id(user_id)
        
        if not alcohol_intake:
            return jsonify({
                'success': True,
                'message': 'No alcohol intake data found',
                'data': None
            }), 200
        
        return jsonify({
            'success': True,
            'message': 'Alcohol intake data retrieved successfully',
            'data': alcohol_intake
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving alcohol intake: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve alcohol intake data'
        }), 500


def delete_alcohol_intake():
    """
    Delete alcohol intake data for authenticated user.
    
    Returns:
        JSON response confirming deletion
    """
    try:
        # Get user_id from request context (set by middleware)
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        deleted = AlcoholIntake.delete_by_user_id(user_id)
        
        if not deleted:
            return jsonify({
                'success': False,
                'message': 'No alcohol intake data found to delete'
            }), 404
        
        logger.info(f"Alcohol intake deleted for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Alcohol intake data deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting alcohol intake: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to delete alcohol intake data'
        }), 500


def get_alcohol_intake_history():
    """
    Get current alcohol intake assessment for authenticated user.
    Note: Only one assessment is stored per user.
    
    Returns:
        JSON response with current assessment data
    """
    try:
        # Get user_id from request context (set by middleware)
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        alcohol_intake = AlcoholIntake.get_by_user_id(user_id)
        
        if not alcohol_intake:
            return jsonify({
                'success': True,
                'message': 'No alcohol intake assessment found',
                'data': None
            }), 200
        
        return jsonify({
            'success': True,
            'message': 'Alcohol intake assessment retrieved successfully',
            'data': alcohol_intake
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving alcohol intake assessment: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve alcohol intake assessment'
        }), 500


def get_risk_assessment():
    """
    Get detailed risk assessment based on alcohol intake.
    
    Returns:
        JSON response with comprehensive risk assessment
    """
    try:
        # Get user_id from request context (set by middleware)
        user_id = getattr(request, 'current_user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not authenticated'
            }), 401
        
        alcohol_intake = AlcoholIntake.get_by_user_id(user_id)
        
        if not alcohol_intake:
            return jsonify({
                'success': True,
                'message': 'No alcohol intake data for risk assessment',
                'data': {
                    'has_data': False,
                    'risk_level': 'unknown',
                    'recommendations': ['Please provide your alcohol consumption data for a complete risk assessment']
                }
            }), 200
        
        # Generate recommendations based on risk category
        recommendations = _generate_recommendations(alcohol_intake)
        
        risk_assessment = {
            'has_data': True,
            'current_consumption': {
                'drinks_per_week': alcohol_intake['drinks_per_week'],
                'average_drinks_per_day': alcohol_intake['average_drinks_per_day'],
                'drinking_days_per_week': alcohol_intake['drinking_days_per_week'],
                'binge_frequency_per_month': alcohol_intake['binge_frequency_per_month']
            },
            'risk_level': alcohol_intake['alcohol_risk_category'],
            'diabetes_risk_score': alcohol_intake['diabetes_risk_score'],
            'diabetes_risk_multiplier': alcohol_intake['diabetes_risk_multiplier'],
            'risk_explanation': alcohol_intake['risk_explanation'],
            'recommendations': recommendations,
            'created_at': alcohol_intake['created_at'],
            'last_updated': alcohol_intake['last_updated']
        }
        
        return jsonify({
            'success': True,
            'message': 'Risk assessment generated successfully',
            'data': risk_assessment
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating risk assessment: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to generate risk assessment'
        }), 500


def get_statistics():
    """
    Get aggregate statistics on alcohol intake patterns (Admin only).
    
    Query Parameters:
        start_date (optional): ISO format date
        end_date (optional): ISO format date
    
    Returns:
        JSON response with statistics
    """
    try:
        # Note: Add admin authentication check in route decorator
        
        from datetime import datetime
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Parse dates if provided
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None
        
        stats = AlcoholIntake.get_statistics(start_dt, end_dt)
        
        return jsonify({
            'success': True,
            'message': 'Statistics retrieved successfully',
            'data': stats
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': f'Invalid date format: {str(e)}'
        }), 400
        
    except Exception as e:
        logger.error(f"Error retrieving statistics: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve statistics'
        }), 500


def _generate_recommendations(alcohol_intake):
    """
    Generate personalized recommendations based on alcohol intake.
    
    Args:
        alcohol_intake (dict): Alcohol intake data
    
    Returns:
        list: List of recommendation strings
    """
    recommendations = []
    risk_category = alcohol_intake['alcohol_risk_category']
    drinks_per_week = alcohol_intake['drinks_per_week']
    binge_frequency = alcohol_intake['binge_frequency_per_month']
    
    if risk_category == 'none':
        recommendations.append('Excellent! Avoiding alcohol reduces your diabetes risk.')
        recommendations.append('Continue your alcohol-free lifestyle for optimal health.')
    
    elif risk_category == 'light':
        recommendations.append('Your alcohol consumption is within low-risk limits.')
        recommendations.append('Maintain current intake or consider reducing further.')
        recommendations.append('Stay within 1 drink per day for optimal health benefits.')
    
    elif risk_category == 'moderate':
        recommendations.append('Your alcohol intake is at moderate risk level.')
        recommendations.append('Consider reducing to ≤7 drinks per week to lower diabetes risk.')
        recommendations.append('Avoid drinking on consecutive days to give your body recovery time.')
        recommendations.append('Monitor your blood glucose levels regularly.')
    
    elif risk_category == 'heavy':
        recommendations.append('⚠️ Your alcohol intake is at high risk level for diabetes.')
        recommendations.append('Strongly consider reducing consumption to <14 drinks per week.')
        recommendations.append('Consult with a healthcare provider about safe reduction strategies.')
        recommendations.append('Heavy drinking increases diabetes risk by 43%.')
        recommendations.append('Consider joining a support group or counseling program.')
    
    elif risk_category == 'binge':
        recommendations.append('⚠️ Binge drinking significantly increases diabetes risk.')
        recommendations.append('Avoid consuming 4+ drinks in one sitting.')
        recommendations.append('Seek professional support to address binge drinking patterns.')
        recommendations.append('Binge drinking can cause acute blood sugar spikes.')
        recommendations.append('Consider evidence-based interventions like SBIRT (Screening, Brief Intervention, and Referral to Treatment).')
    
    # Additional recommendations for high binge frequency
    if binge_frequency >= 4:
        recommendations.append('Your binge drinking frequency is very concerning - please seek medical help.')
    
    # General recommendations
    recommendations.append('Always eat food when drinking to slow alcohol absorption.')
    recommendations.append('Stay hydrated by drinking water between alcoholic beverages.')
    
    return recommendations


def _calculate_trend(alcohol_intake):
    """
    Calculate trend in alcohol consumption.
    Note: Trend tracking is not available as only one assessment is stored per user.
    
    Args:
        alcohol_intake (dict): Alcohol intake data
    
    Returns:
        dict: Trend information
    """
    # Since we only keep one assessment, no trend can be calculated
    return {
        'status': 'single_assessment',
        'message': 'Trend tracking requires multiple assessments over time'
    }
