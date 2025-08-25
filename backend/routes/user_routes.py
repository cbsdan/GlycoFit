from flask import Blueprint
from controllers.auth_controller import AuthController
from controllers.user_info_controller import UserInfoController

user_bp = Blueprint('users', __name__)

# Profile Routes
@user_bp.route('/profile', methods=['GET'])
def get_profile():
    # This will be handled by JWT middleware
    pass

@user_bp.route('/profile', methods=['PUT'])
def update_profile():
    return AuthController.update_my_profile()

# User Info Routes
@user_bp.route('/user-info', methods=['GET'])
def get_all_user_info():
    return UserInfoController.get_all_user_info()

@user_bp.route('/user-info/<info_user_id>', methods=['GET'])
def get_user_info(info_user_id):
    return UserInfoController.get_user_info(info_user_id)

@user_bp.route('/user-info', methods=['POST'])
def create_user_info():
    return UserInfoController.create_user_info()

@user_bp.route('/user-info/<info_id>', methods=['PUT'])
def update_user_info(info_id):
    return UserInfoController.update_user_info(info_id)

@user_bp.route('/user-info/<info_id>', methods=['DELETE'])
def delete_user_info(info_id):
    return UserInfoController.delete_user_info(info_id)

# Glucose Reading Routes (keeping the existing ones)
@user_bp.route('/glucose-readings', methods=['POST'])
def add_glucose_reading():
    # Import here to avoid circular imports
    from flask_jwt_extended import jwt_required, get_jwt_identity
    from config.database import get_db
    from middleware.logging_middleware import log_database_operation, log_error
    from flask import request, jsonify
    import logging
    from datetime import datetime
    from bson import ObjectId
    
    @jwt_required()
    def _add_glucose_reading():
        """Add a glucose reading"""
        try:
            user_id = get_jwt_identity()
            data = request.get_json()
            logging.info(f"Adding glucose reading for user: {user_id}")
            
            # Validate required fields
            if not data.get('value') or not data.get('timestamp'):
                return jsonify({'error': 'Value and timestamp are required'}), 400
            
            db = get_db()
            
            # Create glucose reading document
            reading_doc = {
                'user_id': ObjectId(user_id),
                'value': float(data['value']),
                'timestamp': datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00')),
                'notes': data.get('notes', ''),
                'meal_context': data.get('mealContext'),  # before/after meal
                'created_at': datetime.utcnow()
            }
            
            # Insert reading
            result = db.glucose_readings.insert_one(reading_doc)
            log_database_operation('insert_one', 'glucose_readings', reading_doc, result)
            
            logging.info(f"Glucose reading added successfully for user: {user_id}")
            return jsonify({
                'message': 'Glucose reading added successfully',
                'reading_id': str(result.inserted_id)
            }), 201
            
        except ValueError as e:
            logging.warning(f"Invalid data format: {str(e)}")
            return jsonify({'error': 'Invalid data format'}), 400
        except Exception as e:
            log_error(e, 'Error adding glucose reading')
            return jsonify({'error': 'Internal server error'}), 500
    
    return _add_glucose_reading()

@user_bp.route('/glucose-readings', methods=['GET'])
def get_glucose_readings():
    # Import here to avoid circular imports
    from flask_jwt_extended import jwt_required, get_jwt_identity
    from config.database import get_db
    from middleware.logging_middleware import log_database_operation, log_error
    from flask import request, jsonify
    import logging
    from datetime import datetime
    from bson import ObjectId
    
    @jwt_required()
    def _get_glucose_readings():
        """Get glucose readings for user"""
        try:
            user_id = get_jwt_identity()
            logging.info(f"Getting glucose readings for user: {user_id}")
            
            # Get query parameters
            limit = int(request.args.get('limit', 50))
            offset = int(request.args.get('offset', 0))
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            db = get_db()
            
            # Build query
            query = {'user_id': ObjectId(user_id)}
            
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query['$gte'] = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                if end_date:
                    date_query['$lte'] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query['timestamp'] = date_query
            
            # Get readings
            readings = list(db.glucose_readings.find(query)
                           .sort('timestamp', -1)
                           .skip(offset)
                           .limit(limit))
            
            log_database_operation('find', 'glucose_readings', query, readings)
            
            # Format response
            readings_response = []
            for reading in readings:
                readings_response.append({
                    'id': str(reading['_id']),
                    'value': reading['value'],
                    'timestamp': reading['timestamp'].isoformat(),
                    'notes': reading.get('notes', ''),
                    'meal_context': reading.get('meal_context'),
                    'created_at': reading['created_at'].isoformat()
                })
            
            logging.info(f"Retrieved {len(readings_response)} glucose readings for user: {user_id}")
            return jsonify({
                'message': 'Glucose readings retrieved successfully',
                'readings': readings_response,
                'count': len(readings_response)
            }), 200
            
        except ValueError as e:
            logging.warning(f"Invalid query parameters: {str(e)}")
            return jsonify({'error': 'Invalid query parameters'}), 400
        except Exception as e:
            log_error(e, 'Error getting glucose readings')
            return jsonify({'error': 'Internal server error'}), 500
    
    return _get_glucose_readings()
