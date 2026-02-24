"""
Overall Risk Assessment Controller

Handles HTTP requests for comprehensive diabetes risk assessment
that combines initial assessment, lifestyle trackers, and user biometrics.
"""

from flask import jsonify, request
import logging
from middleware.firebase_auth import firebase_auth_required, get_current_user_id as get_firebase_user_id
from services.comprehensive_risk_service import get_comprehensive_risk_service
from models.overall_risk_assessment import OverallRiskAssessment

logger = logging.getLogger(__name__)


def get_current_user_id():
    """Get the current authenticated user's ID from Firebase auth middleware"""
    try:
        # Try to get from firebase auth middleware
        return get_firebase_user_id()
    except:
        # Fallback to request attribute
        return getattr(request, 'current_user_id', None)


# ==================== OVERALL RISK ASSESSMENT ENDPOINTS ====================

@firebase_auth_required
def get_overall_assessment():
    """
    Get comprehensive diabetes risk assessment for current user.
    Combines all risk factors with weighted scoring.
    
    Response:
    {
        "success": true,
        "data": {
            "overall_risk_score": 45.2,
            "overall_risk_category": "moderate",
            "confidence_level": "high",
            "component_scores": {...},
            "primary_risk_factors": [...],
            "protective_factors": [...],
            "key_improvements": [...],
            "recommendations": [...],
            "explanation": "...",
            "data_quality_notes": "...",
            "category_info": {...}
        }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Unauthorized'
            }), 401
        
        service = get_comprehensive_risk_service()
        
        # Get or compute assessment
        assessment = service.get_assessment(user_id)
        
        if not assessment:
            return jsonify({
                'success': False,
                'error': 'Unable to generate assessment. Please complete initial diabetes assessment first.'
            }), 400
        
        # Add category display info
        category_info = OverallRiskAssessment.get_risk_category_info(
            assessment['overall_risk_category']
        )
        assessment['category_info'] = category_info
        
        return jsonify({
            'success': True,
            'data': assessment
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting overall assessment: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@firebase_auth_required
def refresh_overall_assessment():
    """
    Force refresh/recalculation of overall risk assessment.
    Useful after updating lifestyle data.
    
    Response:
    {
        "success": true,
        "message": "Risk assessment refreshed successfully",
        "data": {...}
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Unauthorized'
            }), 401
        
        service = get_comprehensive_risk_service()
        
        # Force recomputation
        assessment = service.refresh_assessment(user_id)
        
        # Add category display info
        category_info = OverallRiskAssessment.get_risk_category_info(
            assessment['overall_risk_category']
        )
        assessment['category_info'] = category_info
        
        return jsonify({
            'success': True,
            'message': 'Risk assessment refreshed successfully',
            'data': assessment
        }), 200
        
    except Exception as e:
        logger.error(f"Error refreshing overall assessment: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@firebase_auth_required

def get_assessment_history():
    """
    Get historical risk assessments for current user.
    Shows how risk score has changed over time.
    
    Query Parameters:
    - limit: Maximum number of assessments to return (default: 30)
    
    Response:
    {
        "success": true,
        "data": [
            {
                "assessment_date": "2024-02-18",
                "overall_risk_score": 45.2,
                "overall_risk_category": "moderate",
                ...
            },
            ...
        ],
        "count": 15
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Unauthorized'
            }), 401
        
        # Get limit parameter
        limit = request.args.get('limit', 30, type=int)
        limit = min(limit, 100)  # Max 100 records
        
        # Get history
        assessments = OverallRiskAssessment.get_history(user_id, limit)
        
        # Convert to dicts
        assessment_dicts = [a.to_dict() for a in assessments]
        
        # Add category info to each
        for assessment in assessment_dicts:
            category_info = OverallRiskAssessment.get_risk_category_info(
                assessment['overall_risk_category']
            )
            assessment['category_info'] = category_info
        
        return jsonify({
            'success': True,
            'data': assessment_dicts,
            'count': len(assessment_dicts)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting assessment history: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@firebase_auth_required
def get_component_scores():
    """
    Get detailed breakdown of individual component scores.
    
    Response:
    {
        "success": true,
        "data": {
            "initial_assessment": {
                "raw_score": 50,
                "weighted_score": 17.5,
                "weight": 0.35,
                "details": "...",
                ...
            },
            "sleep": {...},
            "steps": {...},
            ...
        }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Unauthorized'
            }), 401
        
        # Get current assessment
        assessment = OverallRiskAssessment.find_by_user_id(user_id)
        
        if not assessment:
            return jsonify({
                'success': False,
                'error': 'No assessment found. Please complete initial diabetes assessment.'
            }), 404
        
        return jsonify({
            'success': True,
            'data': assessment.component_scores
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting component scores: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@firebase_auth_required
def get_risk_factors():
    """
    Get primary risk factors and protective factors.
    
    Response:
    {
        "success": true,
        "data": {
            "primary_risk_factors": [
                {
                    "component": "smoking",
                    "weighted_score": 7.5,
                    "details": "Current smoker - significant risk factor"
                },
                ...
            ],
            "protective_factors": [
                {
                    "component": "alcohol",
                    "weighted_score": 0.4,
                    "details": "Light drinking - may have protective effect"
                },
                ...
            ]
        }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Unauthorized'
            }), 401
        
        # Get current assessment
        assessment = OverallRiskAssessment.find_by_user_id(user_id)
        
        if not assessment:
            return jsonify({
                'success': False,
                'error': 'No assessment found.'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'primary_risk_factors': assessment.primary_risk_factors,
                'protective_factors': assessment.protective_factors
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting risk factors: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@firebase_auth_required
def get_overall_prediction():
    """
    Get predictive trend analysis for the user's overall risk status.
    Determines if the user's status is likely to improve or decline based on
    current lifestyle tracker data and component trajectories.

    Response:
    {
        "success": true,
        "data": {
            "status": "improving",
            "trajectory_score": 24.5,
            "current_risk_score": 45.2,
            "current_risk_category": "moderate",
            "forecast": {
                "days_30": { "predicted_score": 42.1, "predicted_change": -3.1, ... },
                "days_90": { "predicted_score": 38.5, "predicted_change": -6.7, ... }
            },
            "component_trends": { ... },
            "driving_factors": [ ... ],
            "trend_message": "...",
            "confidence": "moderate"
        }
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401

        service = get_comprehensive_risk_service()
        prediction = service.compute_trend_prediction(user_id)

        return jsonify({'success': True, 'data': prediction}), 200

    except Exception as e:
        logger.error(f"Error computing trend prediction: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@firebase_auth_required
def check_assessment_exists():
    """
    Check if user has completed overall risk assessment.
    
    Response:
    {
        "success": true,
        "has_assessment": true,
        "last_updated": "2024-02-18T10:30:00"
    }
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Unauthorized'
            }), 401
        
        assessment = OverallRiskAssessment.find_by_user_id(user_id)
        
        return jsonify({
            'success': True,
            'has_assessment': assessment is not None,
            'last_updated': assessment.updated_at.isoformat() if assessment else None
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking assessment: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== INITIALIZATION ====================

def init_overall_risk_indexes():
    """Initialize database indexes for overall risk assessments"""
    try:
        from models.overall_risk_assessment import ensure_overall_risk_indexes
        ensure_overall_risk_indexes()
        logger.info("Overall risk assessment indexes initialized")
    except Exception as e:
        logger.error(f"Error initializing overall risk indexes: {str(e)}")
        raise
