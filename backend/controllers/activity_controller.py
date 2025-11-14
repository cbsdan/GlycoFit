from flask import request, jsonify
from datetime import datetime, timedelta
from models.user_activity import UserActivity
from config.database import get_db

def save_daily_activity():
    """Save daily activity data"""
    try:
        # Get database connection here
        db = get_db()
        user_activity_model = UserActivity(db)
        
        data = request.get_json()
        
        # Get uid from request object (set by firebase_auth_required decorator)
        uid = getattr(request, 'firebase_user', {}).get('uid')
        
        if not uid:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Validate required fields
        if not data.get('date'):
            return jsonify({'success': False, 'error': 'Date is required'}), 400
        
        # Parse date - handle ISO format with time
        try:
            date_str = data['date']
            # Try ISO format first
            if 'T' in date_str:
                activity_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
            else:
                activity_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except (ValueError, AttributeError) as e:
            return jsonify({'success': False, 'error': f'Invalid date format: {str(e)}'}), 400
        
        activity_data = {
            'steps': data.get('steps', 0),
            'distance': data.get('distance', 0),
            'active_calories': data.get('active_calories', 0),
            'total_calories': data.get('total_calories', 0)
        }
        
        success = user_activity_model.save_daily_activity(uid, activity_date, activity_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Activity saved successfully'}), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to save activity'}), 500
            
    except Exception as e:
        print(f"Error in save_daily_activity: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

def save_exercise_session():
    """Save exercise session"""
    try:
        db = get_db()
        user_activity_model = UserActivity(db)
        data = request.get_json()
        
        # Get uid from request object (set by firebase_auth_required decorator)
        uid = getattr(request, 'firebase_user', {}).get('uid')
        
        if not uid:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Validate required fields
        required_fields = ['exercise_type', 'start_time', 'end_time']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field} is required'}), 400
        
        # Parse timestamps
        try:
            start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid timestamp format'}), 400
        
        session_data = {
            'exercise_type': data['exercise_type'],
            'start_time': start_time,
            'end_time': end_time,
            'duration': data.get('duration'),
            'calories': data.get('calories'),
            'distance': data.get('distance')
        }
        
        session_id = user_activity_model.save_exercise_session(uid, session_data)
        
        if session_id:
            return jsonify({'success': True, 'session_id': session_id, 'message': 'Exercise session saved'}), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to save exercise session'}), 500
            
    except Exception as e:
        print(f"Error in save_exercise_session: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_activities():
    """Get activity data for a date range"""
    try:
        # Get database connection here
        db = get_db()
        user_activity_model = UserActivity(db)
        
        # Get uid from request object (set by firebase_auth_required decorator)
        uid = getattr(request, 'firebase_user', {}).get('uid')
        
        if not uid:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Default to last 30 days if not provided
        if not end_date:
            end_date = datetime.now().date()
        else:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        if not start_date:
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        
        activities = user_activity_model.get_activity_by_date_range(uid, start_date, end_date)
        
        return jsonify({'success': True, 'activities': activities}), 200
        
    except Exception as e:
        print(f"Error in get_activities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_activity_summary():
    """Get activity summary"""
    try:
        # Get database connection here
        db = get_db()
        user_activity_model = UserActivity(db)
        
        # Get uid from request object (set by firebase_auth_required decorator)
        uid = getattr(request, 'firebase_user', {}).get('uid')
        
        if not uid:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Default to last 30 days if not provided
        if not end_date:
            end_date = datetime.now().date()
        else:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        if not start_date:
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        
        summary = user_activity_model.get_activity_summary(uid, start_date, end_date)
        
        if summary:
            return jsonify({'success': True, 'summary': summary}), 200
        else:
            return jsonify({'success': True, 'summary': None, 'message': 'No activity data found'}), 200
        
    except Exception as e:
        print(f"Error in get_activity_summary: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_exercise_sessions():
    """Get exercise sessions"""
    try:
        # Get database connection here
        db = get_db()
        user_activity_model = UserActivity(db)
        
        # Get uid from request object (set by firebase_auth_required decorator)
        uid = getattr(request, 'firebase_user', {}).get('uid')
        
        if not uid:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Get query parameters
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        limit = int(request.args.get('limit', 50))
        
        # Default to last 30 days if not provided
        if not end_time:
            end_time = datetime.now()
        else:
            end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        
        if not start_time:
            start_time = end_time - timedelta(days=30)
        else:
            start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        
        sessions = user_activity_model.get_exercise_sessions(uid, start_time, end_time, limit)
        
        return jsonify({'success': True, 'sessions': sessions}), 200
        
    except Exception as e:
        print(f"Error in get_exercise_sessions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500