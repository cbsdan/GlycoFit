from flask import request, jsonify
from bson import ObjectId
from config.database import get_db
from models.diabetes_assessment import DiabetesAssessment
from services.diabetes_service import get_diabetes_service
import logging

def submit_assessment():
    """Submit or update a diabetes risk assessment"""
    try:
        data = request.get_json()
        user_id = request.current_user_id  # From Firebase auth middleware
        
        if not data or 'answers' not in data:
            return jsonify({'error': 'Assessment answers are required'}), 400
        
        answers = data['answers']
        
        # Validate answers
        is_valid, error_msg = DiabetesAssessment.validate_answers(answers)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Get prediction service
        diabetes_service = get_diabetes_service()
        
        if not diabetes_service.is_initialized:
            return jsonify({'error': 'Diabetes prediction service is not available'}), 503
        
        # Make prediction
        try:
            prediction = diabetes_service.predict(answers)
        except Exception as e:
            logging.error(f"Prediction error: {str(e)}")
            return jsonify({'error': 'Failed to generate prediction'}), 500
        
        # Get database
        db = get_db()
        
        # Check if user already has an assessment
        existing_assessment = db.diabetes_assessments.find_one({'userId': ObjectId(user_id)})
        
        if existing_assessment:
            # Update existing assessment
            update_data = DiabetesAssessment.update(
                assessment_id=existing_assessment['_id'],
                answers=answers,
                prediction=prediction
            )
            
            db.diabetes_assessments.update_one(
                {'_id': existing_assessment['_id']},
                {'$set': update_data}
            )
            
            # Get updated assessment
            updated_assessment = db.diabetes_assessments.find_one({'_id': existing_assessment['_id']})
            result = DiabetesAssessment.to_dict(updated_assessment)
            
            return jsonify({
                'message': 'Assessment updated successfully',
                'assessment': result
            }), 200
        else:
            # Create new assessment
            assessment_data = DiabetesAssessment.create(
                user_id=user_id,
                answers=answers,
                prediction=prediction
            )
            
            result = db.diabetes_assessments.insert_one(assessment_data)
            
            # Get created assessment
            created_assessment = db.diabetes_assessments.find_one({'_id': result.inserted_id})
            result_dict = DiabetesAssessment.to_dict(created_assessment)
            
            return jsonify({
                'message': 'Assessment submitted successfully',
                'assessment': result_dict
            }), 201
            
    except Exception as e:
        logging.error(f"Error submitting assessment: {str(e)}")
        return jsonify({'error': 'Failed to submit assessment'}), 500


def get_my_assessment():
    """Get the current user's diabetes assessment"""
    try:
        user_id = request.current_user_id  # From Firebase auth middleware
        
        # Get database
        db = get_db()
        
        # Find user's assessment
        assessment = db.diabetes_assessments.find_one({'userId': ObjectId(user_id)})
        
        if not assessment:
            return jsonify({'message': 'No assessment found'}), 404
        
        result = DiabetesAssessment.to_dict(assessment)
        
        return jsonify({
            'assessment': result
        }), 200
        
    except Exception as e:
        logging.error(f"Error fetching assessment: {str(e)}")
        return jsonify({'error': 'Failed to fetch assessment'}), 500


def update_assessment_answers():
    """Update specific answers in the assessment"""
    try:
        data = request.get_json()
        user_id = request.current_user_id  # From Firebase auth middleware
        
        if not data or 'answers' not in data:
            return jsonify({'error': 'Answers are required'}), 400
        
        answers_update = data['answers']
        
        # Get database
        db = get_db()
        
        # Find user's assessment
        assessment = db.diabetes_assessments.find_one({'userId': ObjectId(user_id)})
        
        if not assessment:
            return jsonify({'error': 'No assessment found to update'}), 404
        
        # Merge answers
        updated_answers = {**assessment['answers'], **answers_update}
        
        # Validate complete answers
        is_valid, error_msg = DiabetesAssessment.validate_answers(updated_answers)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Get prediction service
        diabetes_service = get_diabetes_service()
        
        if not diabetes_service.is_initialized:
            return jsonify({'error': 'Diabetes prediction service is not available'}), 503
        
        # Recalculate prediction with updated answers
        try:
            prediction = diabetes_service.predict(updated_answers)
        except Exception as e:
            logging.error(f"Prediction error: {str(e)}")
            return jsonify({'error': 'Failed to generate prediction'}), 500
        
        # Update assessment
        update_data = DiabetesAssessment.update(
            assessment_id=assessment['_id'],
            answers=updated_answers,
            prediction=prediction
        )
        
        db.diabetes_assessments.update_one(
            {'_id': assessment['_id']},
            {'$set': update_data}
        )
        
        # Get updated assessment
        updated_assessment = db.diabetes_assessments.find_one({'_id': assessment['_id']})
        result = DiabetesAssessment.to_dict(updated_assessment)
        
        return jsonify({
            'message': 'Assessment answers updated successfully',
            'assessment': result
        }), 200
        
    except Exception as e:
        logging.error(f"Error updating assessment answers: {str(e)}")
        return jsonify({'error': 'Failed to update assessment'}), 500


def delete_assessment():
    """Delete user's assessment (admin only or disabled based on requirements)"""
    try:
        user_id = request.current_user_id
        
        # Get database
        db = get_db()
        
        # Note: Based on requirements, deletion is not allowed
        # This endpoint can be restricted or removed
        return jsonify({'error': 'Assessment deletion is not allowed'}), 403
        
    except Exception as e:
        logging.error(f"Error deleting assessment: {str(e)}")
        return jsonify({'error': 'Failed to delete assessment'}), 500
