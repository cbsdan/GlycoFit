from flask import request, jsonify
from datetime import datetime, timedelta
from models.user_activity import UserActivity
from config.database import get_db
import traceback

def save_daily_activity():
    """Save daily activity data"""
    try:
        print("=" * 50)
        print("SAVE ACTIVITY REQUEST RECEIVED")
        print("=" * 50)
        
        # Get database connection here
        db = get_db()
        user_activity_model = UserActivity(db)
        
        data = request.get_json()
        print(f"📥 Request data: {data}")
        
        # Get uid from request object (set by firebase_auth_required decorator)
        uid = getattr(request, 'firebase_user', {}).get('uid')
        print(f"👤 User UID: {uid}")
        
        if not uid:
            print("❌ No UID found - user not authenticated")
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Validate required fields
        if not data.get('date'):
            print("❌ No date provided")
            return jsonify({'success': False, 'error': 'Date is required'}), 400
        
        # Parse date - handle ISO format with time
        try:
            date_str = data['date']
            print(f"📅 Parsing date: {date_str}")
            # Try ISO format first
            if 'T' in date_str:
                activity_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
            else:
                activity_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            print(f"✅ Parsed date: {activity_date}")
        except (ValueError, AttributeError) as e:
            print(f"❌ Date parsing error: {e}")
            return jsonify({'success': False, 'error': f'Invalid date format: {str(e)}'}), 400
        
        activity_data = {
            'steps': data.get('steps', 0),
            'distance': data.get('distance', 0),
            'active_calories': data.get('activeCalories') or data.get('active_calories', 0),  # Support both camelCase and snake_case
            'total_calories': data.get('totalCalories') or data.get('total_calories', 0),      # Support both camelCase and snake_case
            'source': data.get('source'),  # health_connect or phone_sensor
            'phone_sensor_steps': data.get('phoneSensorSteps', 0),
            'health_connect_steps': data.get('healthConnectSteps', 0),
            'streak': data.get('streak', 0),
            'achievements': data.get('achievements', [])
        }
        print(f"📊 Activity data to save: {activity_data}")
        
        success = user_activity_model.save_daily_activity(uid, activity_date, activity_data)
        print(f"💾 Save result: {success}")
        
        if success:
            print("✅ Activity saved successfully to MongoDB")
            # Retrieve the saved document to return for better client-side sync confirmation
            saved = user_activity_model.get_activity_by_date_range(uid, activity_date, activity_date)
            saved_doc = saved[0] if saved and len(saved) > 0 else None

            # Ensure _id is string for JSON serialization
            if saved_doc and saved_doc.get('_id'):
                try:
                    saved_doc['_id'] = str(saved_doc['_id'])
                except Exception:
                    pass
            # Normalize datetime fields to ISO strings
            if saved_doc:
                try:
                    if saved_doc.get('date') and hasattr(saved_doc.get('date'), 'strftime'):
                        # Ensure UTC Z suffix so JS parses as UTC
                        saved_doc['date'] = saved_doc['date'].strftime('%Y-%m-%dT%H:%M:%SZ')
                except Exception:
                    pass
                try:
                    if saved_doc.get('last_synced_at') and hasattr(saved_doc.get('last_synced_at'), 'strftime'):
                        saved_doc['last_synced_at'] = saved_doc['last_synced_at'].strftime('%Y-%m-%dT%H:%M:%SZ')
                except Exception:
                    pass

            # Also fetch previous day's saved activity (if any) to return for UI display
            previous_day_saved = None
            previous_day_steps = None
            try:
                prev_date = activity_date - timedelta(days=1)
                prev = user_activity_model.get_activity_by_date_range(uid, prev_date, prev_date)
                previous_day_saved = prev[0] if prev and len(prev) > 0 else None
                if previous_day_saved and previous_day_saved.get('_id'):
                    try:
                        previous_day_saved['_id'] = str(previous_day_saved['_id'])
                    except Exception:
                        pass
                # Normalize previous day datetime fields
                if previous_day_saved:
                    try:
                        if previous_day_saved.get('date') and hasattr(previous_day_saved.get('date'), 'strftime'):
                            previous_day_saved['date'] = previous_day_saved['date'].strftime('%Y-%m-%dT%H:%M:%SZ')
                    except Exception:
                        pass
                    try:
                        if previous_day_saved.get('last_synced_at') and hasattr(previous_day_saved.get('last_synced_at'), 'strftime'):
                            previous_day_saved['last_synced_at'] = previous_day_saved['last_synced_at'].strftime('%Y-%m-%dT%H:%M:%SZ')
                    except Exception:
                        pass
                if previous_day_saved:
                    previous_day_steps = previous_day_saved.get('steps', 0)
            except Exception as e:
                print(f"⚠️ Warning fetching previous day activity: {e}")

            return jsonify({
                'success': True,
                'message': 'Activity saved successfully',
                'saved': saved_doc,
                'previous_day_steps': previous_day_steps,
                'previous_day_saved': previous_day_saved
            }), 200
        else:
            print("❌ Failed to save activity")
            return jsonify({'success': False, 'error': 'Failed to save activity'}), 500
            
    except Exception as e:
        print(f"❌ Error in save_daily_activity: {e}")
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
            return jsonify({'success': True, 'session_id': session_id}), 201
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
        limit = int(request.args.get('limit', 0))

        # If caller requests recent items with a limit, return the most recent 'limit' daily records
        if limit and not start_date and not end_date:
            try:
                docs = list(user_activity_model.collection.find({
                    'uid': uid,
                    'activity_type': 'daily'
                }).sort('date', -1).limit(limit))

                # Normalize docs
                for d in docs:
                    d['_id'] = str(d['_id'])
                    try:
                        if d.get('date') and hasattr(d.get('date'), 'isoformat'):
                            d['date'] = d['date'].isoformat()
                    except Exception:
                        pass
                    try:
                        if d.get('last_synced_at') and hasattr(d.get('last_synced_at'), 'isoformat'):
                            d['last_synced_at'] = d['last_synced_at'].isoformat()
                    except Exception:
                        pass

                return jsonify({'success': True, 'activities': docs}), 200
            except Exception as e:
                print(f"Error fetching recent activities: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        # Default to last 30 days if not provided
        if not end_date:
            end_date = datetime.now()
        else:
            end_date = datetime.fromisoformat(end_date)
            
        if not start_date:
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.fromisoformat(start_date)
        
        activities = user_activity_model.get_activity_by_date_range(uid, start_date, end_date)
        
        return jsonify({'success': True, 'activities': activities}), 200
        
    except Exception as e:
        print(f"Error in get_activities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_activity_summary():
    """Get activity summary"""
    try:
        db = get_db()
        user_activity_model = UserActivity(db)
        
        uid = getattr(request, 'firebase_user', {}).get('uid')
        
        if not uid:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not end_date:
            end_date = datetime.now()
        else:
            end_date = datetime.fromisoformat(end_date)
            
        if not start_date:
            start_date = end_date - timedelta(days=7)
        else:
            start_date = datetime.fromisoformat(start_date)
        
        summary = user_activity_model.get_activity_summary(uid, start_date, end_date)
        
        return jsonify({'success': True, 'summary': summary}), 200
        
    except Exception as e:
        print(f"Error in get_activity_summary: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_exercise_sessions():
    """Get exercise sessions"""
    try:
        db = get_db()
        user_activity_model = UserActivity(db)
        
        uid = getattr(request, 'firebase_user', {}).get('uid')
        
        if not uid:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        limit = int(request.args.get('limit', 50))
        
        if not end_time:
            end_time = datetime.now()
        else:
            end_time = datetime.fromisoformat(end_time)
            
        if not start_time:
            start_time = end_time - timedelta(days=30)
        else:
            start_time = datetime.fromisoformat(start_time)
        
        sessions = user_activity_model.get_exercise_sessions(uid, start_time, end_time, limit)
        
        return jsonify({'success': True, 'sessions': sessions}), 200
        
    except Exception as e:
        print(f"Error in get_exercise_sessions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500