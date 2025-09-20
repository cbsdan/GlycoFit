from flask import request, jsonify
from models.heart_rate import HeartRate
from middleware.firebase_auth import firebase_auth_required, get_current_user_id
import logging
from datetime import datetime, timedelta
from bson import ObjectId

class HeartRateController:
    
    @staticmethod
    @firebase_auth_required
    def create_heart_rate():
        """Create a new heart rate record"""
        try:
            user_id = get_current_user_id()
            data = request.get_json()
            
            logging.info(f"Creating heart rate record for user: {user_id}")
            
            # Validate required fields
            if not data or 'heart_rate' not in data:
                return jsonify({'error': 'Heart rate is required'}), 400
            
            heart_rate_value = data.get('heart_rate')
            
            # Validate heart rate value
            if not isinstance(heart_rate_value, int) or heart_rate_value <= 0 or heart_rate_value > 300:
                return jsonify({'error': 'Heart rate must be a positive integer between 1 and 300'}), 400
            
            # Validate confidence level if provided
            confidence_level = data.get('confidence_level')
            if confidence_level is not None:
                if not isinstance(confidence_level, (int, float)) or not (0 <= confidence_level <= 1):
                    return jsonify({'error': 'Confidence level must be a number between 0 and 1'}), 400
            
            # Create heart rate record
            heart_rate = HeartRate(
                user_id=user_id,
                heart_rate=heart_rate_value,
                confidence_level=confidence_level,
                activity_context=data.get('activity_context'),
                notes=data.get('notes')
            )
            
            # Save to database
            heart_rate_id = heart_rate.save()
            
            logging.info(f"Heart rate record created successfully with ID: {heart_rate_id}")
            
            return jsonify({
                'message': 'Heart rate record created successfully',
                'heart_rate_id': heart_rate_id,
                'data': {
                    'id': heart_rate_id,
                    'user_id': user_id,
                    'heart_rate': heart_rate_value,
                    'confidence_level': confidence_level,
                    'activity_context': data.get('activity_context'),
                    'notes': data.get('notes'),
                    'created_at': heart_rate.created_at.isoformat(),
                    'updated_at': heart_rate.updated_at.isoformat()
                }
            }), 201
            
        except Exception as e:
            logging.error(f"Error creating heart rate record: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def get_heart_rates():
        """Get heart rate records for the authenticated user with pagination"""
        try:
            user_id = get_current_user_id()
            
            # Get query parameters
            page = request.args.get('page', 1, type=int)
            limit = request.args.get('limit', 10, type=int)
            sort_by = request.args.get('sort_by', 'created_at')
            sort_order = request.args.get('sort_order', 'desc')
            
            # Validate parameters
            if limit > 100:
                limit = 100  # Maximum limit
            
            if sort_order.lower() == 'asc':
                sort_order = 1
            else:
                sort_order = -1
            
            skip = (page - 1) * limit
            
            logging.info(f"Getting heart rate records for user: {user_id}, page: {page}, limit: {limit}")
            
            # Get heart rate records
            heart_rates = HeartRate.find_by_user_id(
                user_id=user_id,
                limit=limit,
                skip=skip,
                sort_by=sort_by,
                sort_order=sort_order
            )
            
            # Format datetime fields for JSON serialization
            for heart_rate in heart_rates:
                if 'created_at' in heart_rate:
                    heart_rate['created_at'] = heart_rate['created_at'].isoformat()
                if 'updated_at' in heart_rate:
                    heart_rate['updated_at'] = heart_rate['updated_at'].isoformat()
            
            return jsonify({
                'message': 'Heart rate records retrieved successfully',
                'data': heart_rates,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total_records': len(heart_rates)
                }
            }), 200
            
        except Exception as e:
            logging.error(f"Error getting heart rate records: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def get_heart_rate_by_id(heart_rate_id):
        """Get a specific heart rate record by ID"""
        try:
            user_id = get_current_user_id()
            
            logging.info(f"Getting heart rate record {heart_rate_id} for user: {user_id}")
            
            # Validate ObjectId format
            try:
                ObjectId(heart_rate_id)
            except:
                return jsonify({'error': 'Invalid heart rate ID format'}), 400
            
            # Get heart rate record
            heart_rate = HeartRate.find_by_id(heart_rate_id)
            
            if not heart_rate:
                return jsonify({'error': 'Heart rate record not found'}), 404
            
            # Check if the record belongs to the authenticated user
            if heart_rate['user_id'] != user_id:
                return jsonify({'error': 'Access denied'}), 403
            
            # Format datetime fields
            if 'created_at' in heart_rate:
                heart_rate['created_at'] = heart_rate['created_at'].isoformat()
            if 'updated_at' in heart_rate:
                heart_rate['updated_at'] = heart_rate['updated_at'].isoformat()
            
            return jsonify({
                'message': 'Heart rate record retrieved successfully',
                'data': heart_rate
            }), 200
            
        except Exception as e:
            logging.error(f"Error getting heart rate record by ID: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def update_heart_rate(heart_rate_id):
        """Update a heart rate record"""
        try:
            user_id = get_current_user_id()
            data = request.get_json()
            
            logging.info(f"Updating heart rate record {heart_rate_id} for user: {user_id}")
            
            # Validate ObjectId format
            try:
                ObjectId(heart_rate_id)
            except:
                return jsonify({'error': 'Invalid heart rate ID format'}), 400
            
            if not data:
                return jsonify({'error': 'No data provided for update'}), 400
            
            # Get existing heart rate record
            existing_heart_rate = HeartRate.find_by_id(heart_rate_id)
            
            if not existing_heart_rate:
                return jsonify({'error': 'Heart rate record not found'}), 404
            
            # Check if the record belongs to the authenticated user
            if existing_heart_rate['user_id'] != user_id:
                return jsonify({'error': 'Access denied'}), 403
            
            # Prepare update data
            update_data = {}
            
            # Validate and update heart rate if provided
            if 'heart_rate' in data:
                heart_rate_value = data['heart_rate']
                if not isinstance(heart_rate_value, int) or heart_rate_value <= 0 or heart_rate_value > 300:
                    return jsonify({'error': 'Heart rate must be a positive integer between 1 and 300'}), 400
                update_data['heart_rate'] = heart_rate_value
            
            # Validate and update confidence level if provided
            if 'confidence_level' in data:
                confidence_level = data['confidence_level']
                if confidence_level is not None:
                    if not isinstance(confidence_level, (int, float)) or not (0 <= confidence_level <= 1):
                        return jsonify({'error': 'Confidence level must be a number between 0 and 1'}), 400
                update_data['confidence_level'] = confidence_level
            
            # Update other optional fields
            if 'activity_context' in data:
                update_data['activity_context'] = data['activity_context']
            
            if 'notes' in data:
                update_data['notes'] = data['notes']
            
            if not update_data:
                return jsonify({'error': 'No valid fields provided for update'}), 400
            
            # Update the record
            success = HeartRate.update_by_id(heart_rate_id, update_data)
            
            if not success:
                return jsonify({'error': 'Failed to update heart rate record'}), 500
            
            # Get updated record
            updated_heart_rate = HeartRate.find_by_id(heart_rate_id)
            
            # Format datetime fields
            if 'created_at' in updated_heart_rate:
                updated_heart_rate['created_at'] = updated_heart_rate['created_at'].isoformat()
            if 'updated_at' in updated_heart_rate:
                updated_heart_rate['updated_at'] = updated_heart_rate['updated_at'].isoformat()
            
            return jsonify({
                'message': 'Heart rate record updated successfully',
                'data': updated_heart_rate
            }), 200
            
        except Exception as e:
            logging.error(f"Error updating heart rate record: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def delete_heart_rate(heart_rate_id):
        """Delete a heart rate record"""
        try:
            user_id = get_current_user_id()
            
            logging.info(f"Deleting heart rate record {heart_rate_id} for user: {user_id}")
            
            # Validate ObjectId format
            try:
                ObjectId(heart_rate_id)
            except:
                return jsonify({'error': 'Invalid heart rate ID format'}), 400
            
            # Get existing heart rate record
            existing_heart_rate = HeartRate.find_by_id(heart_rate_id)
            
            if not existing_heart_rate:
                return jsonify({'error': 'Heart rate record not found'}), 404
            
            # Check if the record belongs to the authenticated user
            if existing_heart_rate['user_id'] != user_id:
                return jsonify({'error': 'Access denied'}), 403
            
            # Delete the record
            success = HeartRate.delete_by_id(heart_rate_id)
            
            if not success:
                return jsonify({'error': 'Failed to delete heart rate record'}), 500
            
            return jsonify({
                'message': 'Heart rate record deleted successfully'
            }), 200
            
        except Exception as e:
            logging.error(f"Error deleting heart rate record: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def get_latest_heart_rate():
        """Get the latest heart rate record for the authenticated user"""
        try:
            user_id = get_current_user_id()
            
            logging.info(f"Getting latest heart rate for user: {user_id}")
            
            # Get latest heart rate record
            heart_rate = HeartRate.get_latest_by_user_id(user_id)
            
            if not heart_rate:
                return jsonify({
                    'message': 'No heart rate records found',
                    'data': None
                }), 200
            
            # Format datetime fields
            if 'created_at' in heart_rate:
                heart_rate['created_at'] = heart_rate['created_at'].isoformat()
            if 'updated_at' in heart_rate:
                heart_rate['updated_at'] = heart_rate['updated_at'].isoformat()
            
            return jsonify({
                'message': 'Latest heart rate record retrieved successfully',
                'data': heart_rate
            }), 200
            
        except Exception as e:
            logging.error(f"Error getting latest heart rate: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def get_heart_rate_statistics():
        """Get heart rate statistics for the authenticated user"""
        try:
            user_id = get_current_user_id()
            
            # Get query parameters for date range
            start_date_str = request.args.get('start_date')
            end_date_str = request.args.get('end_date')
            
            start_date = None
            end_date = None
            
            # Parse date parameters if provided
            if start_date_str:
                try:
                    start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                except:
                    return jsonify({'error': 'Invalid start_date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
            
            if end_date_str:
                try:
                    end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                except:
                    return jsonify({'error': 'Invalid end_date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
            
            # If no date range specified, default to last 30 days
            if not start_date and not end_date:
                end_date = datetime.utcnow()
                start_date = end_date - timedelta(days=30)
            
            logging.info(f"Getting heart rate statistics for user: {user_id}")
            
            # Get statistics
            stats = HeartRate.get_statistics(user_id, start_date, end_date)
            
            if stats is None:
                return jsonify({'error': 'Failed to retrieve statistics'}), 500
            
            return jsonify({
                'message': 'Heart rate statistics retrieved successfully',
                'data': stats,
                'date_range': {
                    'start_date': start_date.isoformat() if start_date else None,
                    'end_date': end_date.isoformat() if end_date else None
                }
            }), 200
            
        except Exception as e:
            logging.error(f"Error getting heart rate statistics: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @staticmethod
    @firebase_auth_required
    def get_heart_rates_by_date_range():
        """Get heart rate records within a specific date range"""
        try:
            user_id = get_current_user_id()
            
            # Get required date parameters
            start_date_str = request.args.get('start_date')
            end_date_str = request.args.get('end_date')
            
            if not start_date_str or not end_date_str:
                return jsonify({'error': 'Both start_date and end_date are required'}), 400
            
            # Parse dates
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            except:
                return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
            
            if start_date > end_date:
                return jsonify({'error': 'start_date cannot be later than end_date'}), 400
            
            logging.info(f"Getting heart rate records by date range for user: {user_id}")
            
            # Get heart rate records in date range
            heart_rates = HeartRate.find_by_date_range(user_id, start_date, end_date)
            
            # Format datetime fields
            for heart_rate in heart_rates:
                if 'created_at' in heart_rate:
                    heart_rate['created_at'] = heart_rate['created_at'].isoformat()
                if 'updated_at' in heart_rate:
                    heart_rate['updated_at'] = heart_rate['updated_at'].isoformat()
            
            return jsonify({
                'message': 'Heart rate records retrieved successfully',
                'data': heart_rates,
                'date_range': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'count': len(heart_rates)
            }), 200
            
        except Exception as e:
            logging.error(f"Error getting heart rate records by date range: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
