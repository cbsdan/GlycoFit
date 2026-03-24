from flask import Blueprint, jsonify, request
from models.user import User
from models.user_meal import UserMeal
from datetime import datetime, timedelta
from bson import ObjectId
import logging
from controllers.admin_controller import (
    # Dashboard
    get_risk_distribution,
    get_tracker_adoption,
    get_consultations_summary,
    get_recent_activity,
    # User extended
    get_user_risk_overview,
    get_user_trackers,
    get_user_assessment,
    get_user_activity,
    delete_user,
    # Physician management
    get_physicians_list,
    get_physician_details,
    get_physician_patients,
    get_physician_consultations,
    get_physician_availability,
    # Risk & Assessments
    get_risk_component_averages,
    get_risk_trend,
    get_high_risk_patients,
    get_assessment_stats,
    get_assessments_list,
    # Trackers
    get_food_tracker_stats,
    get_step_tracker_stats,
    get_sleep_tracker_stats,
    get_smoking_tracker_stats,
    get_alcohol_tracker_stats,
    # Meals extended
    get_meals_stats,
    get_meals_nutrient_trends,
    browse_meals,
    # Consultations
    get_consultations_list,
    get_consultation_detail,
    get_appointments_list,
    get_prescriptions_list,
    # Chat
    get_chat_stats,
    get_chat_conversations,
    get_conversation_messages,
    # AI & Chatbot
    get_chatbot_stats,
    get_chatbot_conversations,
    get_ai_food_analysis_stats,
    # System
    get_system_health,
    get_database_stats,
    get_platform_config,
    get_system_logs,
)

admin_bp = Blueprint('admin_blueprint', __name__)

@admin_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(status='ok', message='Admin routes are working')

@admin_bp.route("/users", methods=["GET"])
def get_all_users():
    try:
        logging.info("=== [ADMIN] Fetching all users ===")

        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 50, type=int)

        from config.database import get_db
        db = get_db()
        raw_users = list(db.users.find().skip(skip).limit(limit))
        logging.info(f"[ADMIN] Found {len(raw_users)} documents in database")

        users_data = []
        for idx, doc in enumerate(raw_users):
            try:
                # Skip documents that are missing required fields
                if not doc.get('uid') or not doc.get('email'):
                    logging.warning(f"[ADMIN] Skipping malformed user doc _id={doc.get('_id')}: missing uid or email")
                    continue
                user = User.from_dict(doc)
                user._id = doc['_id']
                user_dict = user.to_safe_dict()
                users_data.append(user_dict)
                if idx == 0:
                    logging.info(f"[ADMIN] Sample user 0: {user_dict}")
            except Exception as e:
                logging.error(f"[ADMIN] Error converting user doc _id={doc.get('_id')}: {str(e)}", exc_info=True)
                continue

        logging.info(f"[ADMIN] Successfully returning {len(users_data)} users")
        return jsonify(users=users_data, total=len(users_data))

    except Exception as e:
        logging.error(f"[ADMIN] Error in get_all_users: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        return jsonify(error=f"Failed to fetch users: {str(e)}", details=traceback.format_exc()), 500

@admin_bp.route("/users/stats", methods=["GET"])
def get_users_stats():
    """Get user statistics"""
    try:
        from config.database import get_db
        db = get_db()
        raw_users = list(db.users.find())

        users = []
        for doc in raw_users:
            try:
                if not doc.get('uid') or not doc.get('email'):
                    continue
                u = User.from_dict(doc)
                u._id = doc['_id']
                users.append(u)
            except Exception as e:
                logging.warning(f"[ADMIN] Skipping malformed doc in stats _id={doc.get('_id')}: {e}")
                continue

        total_users = len(users)
        physicians = sum(1 for u in users if (u.role or '').lower() == 'physician')
        disabled_users = sum(1 for u in users if u.is_currently_disabled())

        # Active users: roles 'user' and 'admin', not disabled
        active_users = sum(
            1 for u in users
            if (u.role or '').lower() in ['user', 'admin'] and not u.is_currently_disabled()
        )

        return jsonify({
            'total_users': total_users,
            'physicians': physicians,
            'regular_users': total_users - physicians,
            'disabled_users': disabled_users,
            'active_users': active_users
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error getting user stats: {str(e)}")
        return jsonify(error=str(e)), 500


@admin_bp.route("/users/analytics", methods=["GET"])
def get_users_analytics():
    """Return registrations per day and active/inactive counts between start and end dates
    Query params:
      - start: ISO datetime string
      - end: ISO datetime string
    If missing, defaults to last 30 days.
    """
    try:
        db = __import__('config.database', fromlist=['get_db']).database.get_db()
    except Exception:
        from config.database import get_db
        db = get_db()

    try:
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        now = datetime.utcnow()
        if start_str and end_str:
            try:
                start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            except Exception:
                return jsonify(error='Invalid date format for start/end'), 400
        else:
            end = now
            start = now - timedelta(days=30)

        # Aggregate registrations per day
        pipeline = [
            {"$match": {"created_at": {"$gte": start, "$lte": end}}},
            {"$project": {"date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}}},
            {"$group": {"_id": "$date", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]

        agg = list(db.users.aggregate(pipeline))
        counts_by_date = {item['_id']: item['count'] for item in agg}

        # Build full series for each day in range
        series = []
        cur = start
        while cur.date() <= end.date():
            key = cur.strftime('%Y-%m-%d')
            # return ISO date string at UTC midnight so frontend date adapter can parse
            iso_date = f"{key}T00:00:00Z"
            series.append({"date": iso_date, "count": counts_by_date.get(key, 0)})
            cur = cur + timedelta(days=1)

        # Compute active, temporarily disabled, and permanently disabled counts
        active_count = 0
        temporary_disabled_count = 0
        permanent_disabled_count = 0
        temp_ids = []
        perm_ids = []
        active_ids = []

        cursor = db.users.find({}, {"disable_history": 1})
        now = datetime.utcnow()
        for u in cursor:
            uid = str(u.get('_id'))
            temp_disabled = False
            perm_disabled = False
            for rec in u.get('disable_history', []):
                # permanent disable
                if rec.get('is_permanent', False):
                    perm_disabled = True
                    break

                # active temporary disable record
                if rec.get('is_active', False) and not rec.get('is_permanent', False):
                    temp_disabled = True
                    break

                # end_date in the future => temporary disable
                end_date = rec.get('end_date')
                if end_date:
                    try:
                        if isinstance(end_date, str):
                            ed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                        else:
                            ed = end_date
                        if ed > now and not rec.get('is_permanent', False):
                            temp_disabled = True
                            break
                    except Exception:
                        continue

            if perm_disabled:
                permanent_disabled_count += 1
                perm_ids.append(uid)
            elif temp_disabled:
                temporary_disabled_count += 1
                temp_ids.append(uid)
            else:
                active_count += 1
                active_ids.append(uid)

        logging.info(f"[ADMIN] users analytics counts - active: {active_count}, temporary: {temporary_disabled_count}, permanent: {permanent_disabled_count}")

        result = {
            'registration': series,
            'active_count': active_count,
            'temporary_disabled_count': temporary_disabled_count,
            'permanent_disabled_count': permanent_disabled_count
        }

        # If debug flag is provided, return lists of ids for inspection
        debug_flag = request.args.get('debug')
        if debug_flag in ['1', 'true', 'True']:
            result['temporary_ids'] = temp_ids
            result['permanent_ids'] = perm_ids
            result['active_ids'] = active_ids

        return jsonify(result)

    except Exception as e:
        logging.error(f"[ADMIN] Error in users analytics: {str(e)}", exc_info=True)
        return jsonify(error=str(e)), 500

@admin_bp.route("/meals/top-foods", methods=["GET"])
def get_top_foods():
    """Return top foods (most common meal names) within a timeframe
    Query params:
      - start: ISO datetime string
      - end: ISO datetime string
      - limit: max number of foods to return (default 10)
    """
    try:
        db = __import__('config.database', fromlist=['get_db']).database.get_db()
    except Exception:
        from config.database import get_db
        db = get_db()

    try:
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        limit = request.args.get('limit', 10, type=int)
        
        now = datetime.utcnow()
        if start_str and end_str:
            try:
                start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            except Exception:
                return jsonify(error='Invalid date format for start/end'), 400
        else:
            end = now
            start = now - timedelta(days=30)

        # Aggregate meals by meal_name within timeframe
        pipeline = [
            {"$match": {
                "meal_datetime": {"$gte": start, "$lte": end},
                "meal_name": {"$exists": True, "$ne": None, "$ne": ""}
            }},
            {"$group": {
                "_id": "$meal_name",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]

        agg = list(db.user_meals.aggregate(pipeline))
        
        top_foods = [
            {
                "food": item['_id'],
                "count": item['count']
            }
            for item in agg
        ]

        return jsonify({
            'top_foods': top_foods,
            'timeframe': {
                'start': start.isoformat(),
                'end': end.isoformat()
            }
        })

    except Exception as e:
        logging.error(f"[ADMIN] Error in top foods: {str(e)}", exc_info=True)
        return jsonify(error=str(e)), 500

@admin_bp.route("/meals/averages", methods=["GET"])
def get_meal_averages():
    """Return average daily meals and average calories per day
    Query params:
      - start: ISO datetime string
      - end: ISO datetime string
    Returns overall averages and per-user breakdown
    """
    try:
        db = __import__('config.database', fromlist=['get_db']).database.get_db()
    except Exception:
        from config.database import get_db
        db = get_db()

    try:
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        
        now = datetime.utcnow()
        if start_str and end_str:
            try:
                start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            except Exception:
                return jsonify(error='Invalid date format for start/end'), 400
        else:
            end = now
            start = now - timedelta(days=30)

        # Calculate number of days in timeframe
        days_count = max(1, (end - start).days + 1)

        # Get all meals in timeframe
        meals = list(db.user_meals.find({
            "meal_datetime": {"$gte": start, "$lte": end}
        }))

        if not meals:
            return jsonify({
                'overall': {
                    'avg_daily_meals': 0,
                    'avg_daily_calories': 0,
                    'total_meals': 0,
                    'total_calories': 0
                },
                'per_user': [],
                'timeframe': {
                    'start': start.isoformat(),
                    'end': end.isoformat(),
                    'days': days_count
                }
            })

        # Calculate overall stats
        total_meals = len(meals)
        total_calories = sum(
            float(m.get('nutrients', {}).get('Calories', 0) or 0)
            for m in meals
        )

        # Group meals by user
        user_meals = {}
        for meal in meals:
            user_id = str(meal.get('user_id'))
            if user_id not in user_meals:
                user_meals[user_id] = {
                    'meals': [],
                    'total_calories': 0
                }
            user_meals[user_id]['meals'].append(meal)
            user_meals[user_id]['total_calories'] += float(
                meal.get('nutrients', {}).get('Calories', 0) or 0
            )

        # Calculate per-user averages
        per_user_stats = []
        for user_id, data in user_meals.items():
            # Get user info
            user = db.users.find_one({'_id': ObjectId(user_id)})
            user_name = 'Unknown'
            if user:
                first = user.get('first_name', '')
                last = user.get('last_name', '')
                user_name = f"{first} {last}".strip() or user.get('email', 'Unknown')

            meal_count = len(data['meals'])
            per_user_stats.append({
                'user_id': user_id,
                'user_name': user_name,
                'total_meals': meal_count,
                'total_calories': round(data['total_calories'], 2),
                'avg_daily_meals': round(meal_count / days_count, 2),
                'avg_daily_calories': round(data['total_calories'] / days_count, 2)
            })

        # Sort by avg_daily_meals descending
        per_user_stats.sort(key=lambda x: x['avg_daily_meals'], reverse=True)

        return jsonify({
            'overall': {
                'avg_daily_meals': round(total_meals / days_count, 2),
                'avg_daily_calories': round(total_calories / days_count, 2),
                'total_meals': total_meals,
                'total_calories': round(total_calories, 2)
            },
            'per_user': per_user_stats,
            'timeframe': {
                'start': start.isoformat(),
                'end': end.isoformat(),
                'days': days_count
            }
        })

    except Exception as e:
        logging.error(f"[ADMIN] Error in meal averages: {str(e)}", exc_info=True)
        return jsonify(error=str(e)), 500

@admin_bp.route("/users/create", methods=["POST"])
def create_user():
    from firebase_admin import auth
    
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['first_name', 'last_name', 'email', 'password', 'role']
    if not all(field in data for field in required_fields):
        return jsonify(error='Missing required fields'), 400
    
    email = data['email'].lower().strip()
    first_name = data['first_name'].strip()
    last_name = data['last_name'].strip()
    role = data['role'].strip()
    password = data['password']
    
    # Validate role
    if role not in ['user', 'physician', 'admin']:
        return jsonify(error='Invalid role'), 400
    
    # Check if user already exists in MongoDB
    existing_user = User.find_by_email(email)
    if existing_user:
        return jsonify(error='User with this email already exists'), 400
    
    # Validate password length
    if len(password) < 6:
        return jsonify(error='Password must be at least 6 characters'), 400
    
    try:
        firebase_created = False
        uid = None

        # Try to create user in Firebase; if it fails (credentials or other issues)
        # fall back to creating a local MongoDB-only user with a generated UID.
        try:
            firebase_user = auth.create_user(
                email=email,
                password=password,
                display_name=f"{first_name} {last_name}"
            )
            # Set custom claims for role (only if firebase succeeded)
            auth.set_custom_user_claims(firebase_user.uid, {'role': role})
            uid = firebase_user.uid
            firebase_created = True
        except auth.EmailAlreadyExistsError:
            return jsonify(error='Email already registered in Firebase'), 400
        except Exception as fe:
            # Log and continue — we'll create a local user record instead
            logging.warning(f"Firebase user creation failed, falling back to local user: {fe}")
            uid = str(ObjectId())
            firebase_created = False

        # Create user record in MongoDB (use firebase uid if available, otherwise generated uid)
        user = User(
            uid=uid,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=role
        )
        user.save()

        logging.info(f"New {role} created: {email} (firebase_created={firebase_created})")

        message = f'{role.capitalize()} created successfully'
        if not firebase_created:
            message += ' (firebase unavailable; created local user only)'

        return jsonify(
            success=True,
            message=message,
            user=user.to_safe_dict(),
            firebase_created=firebase_created
        ), 201

    except Exception as e:
        logging.error(f"Error creating user: {str(e)}", exc_info=True)
        return jsonify(error=f'Failed to create user: {str(e)}'), 500

@admin_bp.route("/users/<user_id>/meals", methods=["GET"])
def get_user_meals_by_id(user_id):
    """Get paginated meals for a user by MongoDB user ID"""
    try:
        user = User.find_by_id(user_id)
        if not user:
            return jsonify(error='User not found'), 404

        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 50)
        offset = (page - 1) * per_page

        result = UserMeal.get_user_meals_paginated(user._id, limit=per_page, offset=offset)
        if result.get('success'):
            return jsonify(
                status='success',
                meals=result['meals'],
                count=result.get('count', 0),
                total=result.get('total', 0),
                page=page,
                per_page=per_page,
            ), 200
        else:
            return jsonify(
                status='error',
                error=result.get('error', 'Unknown error')
            ), 400
    except Exception as e:
        logging.error(f"Error getting user meals: {str(e)}")
        return jsonify(status='error', error=str(e)), 500

@admin_bp.route("/users/<uid>/meals", methods=["GET"])
def get_user_meals(uid):
    user = User.find_by_uid(uid)
    if not user:
        return jsonify(error='User not found'), 404
    
    result = UserMeal.get_user_meals(user._id)
    if result.get('success'):
        return jsonify(meals=result['meals'], count=result.get('count', 0))
    else:
        return jsonify(error=result.get('error', 'Unknown error')), 400

@admin_bp.route("/users/<uid>/sleep", methods=["GET"])
def get_user_sleep_data(uid):
    """Get sleep data for a specific user
    Query params:
      - start: ISO datetime string
      - end: ISO datetime string
      - days: number of days (default 30)
    Returns sleep records and average sleep hours
    """
    try:
        db = __import__('config.database', fromlist=['get_db']).database.get_db()
    except Exception:
        from config.database import get_db
        db = get_db()

    try:
        # Try to find user by UID first, then by MongoDB ID
        user = User.find_by_uid(uid)
        if not user:
            user = User.find_by_id(uid)
        if not user:
            return jsonify(error='User not found'), 404

        # Get timeframe parameters
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        days_param = request.args.get('days', 30, type=int)
        
        now = datetime.utcnow()
        if start_str and end_str:
            try:
                start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            except Exception:
                return jsonify(error='Invalid date format for start/end'), 400
        else:
            end = now
            start = now - timedelta(days=days_param)

        # Convert datetime to date strings for comparison (YYYY-MM-DD format)
        start_date_str = start.strftime('%Y-%m-%d')
        end_date_str = end.strftime('%Y-%m-%d')

        # Get sleep daily records - filter by date field, not created_at
        sleep_records = list(db.sleep_daily_records.find({
            'user_id': str(user._id),
            'date': {'$gte': start_date_str, '$lte': end_date_str}
        }).sort('date', -1))

        # Convert ObjectId to string and format dates
        formatted_records = []
        total_hours = 0
        count = 0

        for record in sleep_records:
            record['_id'] = str(record['_id'])
            formatted_records.append({
                'id': str(record.get('_id')),
                'date': record.get('date'),
                'bedtime': record.get('bedtime'),
                'wake_time': record.get('wake_time'),
                'sleep_duration_hours': record.get('sleep_duration_hours'),
                'source': record.get('source'),
                'sleep_quality': record.get('sleep_quality'),
                'notes': record.get('notes'),
                'created_at': record.get('created_at').isoformat() if record.get('created_at') else None
            })
            
            if record.get('sleep_duration_hours'):
                total_hours += float(record.get('sleep_duration_hours'))
                count += 1

        # Calculate average
        avg_sleep_hours = round(total_hours / count, 2) if count > 0 else 0

        # Get baseline if exists
        baseline = db.sleep_baselines.find_one({'user_id': str(user._id)})
        baseline_data = None
        if baseline:
            baseline_data = {
                'baseline_avg_sleep_hours': baseline.get('baseline_avg_sleep_hours'),
                'usual_bedtime': baseline.get('usual_bedtime'),
                'usual_wake_time': baseline.get('usual_wake_time'),
                'baseline_nights_6h_plus_per_week': baseline.get('baseline_nights_6h_plus_per_week'),
                'baseline_bedtime_consistency': baseline.get('baseline_bedtime_consistency')
            }

        return jsonify({
            'success': True,
            'sleep_records': formatted_records,
            'total_records': len(formatted_records),
            'avg_sleep_hours': avg_sleep_hours,
            'baseline': baseline_data,
            'timeframe': {
                'start': start.isoformat(),
                'end': end.isoformat(),
                'days': (end - start).days + 1
            }
        })

    except Exception as e:
        logging.error(f"[ADMIN] Error fetching user sleep data: {str(e)}", exc_info=True)
        return jsonify(error=str(e)), 500

@admin_bp.route("/users/<uid>/disable", methods=["POST"])
def disable_user(uid):
    data = request.get_json()
    reason = data.get('reason', 'User disabled by admin')
    is_permanent = data.get('is_permanent', False)
    days = data.get('days', 7)
    
    user = User.find_by_uid(uid)
    if not user:
        return jsonify(error='User not found'), 404
    
    end_date = None if is_permanent else datetime.utcnow() + timedelta(days=days)
    user.add_disable_record(reason, end_date, is_permanent)
    user.save()
    
    return jsonify(success=True, message='User disabled successfully')

@admin_bp.route("/users/<uid>/enable", methods=["POST"])
def enable_user(uid):
    data = request.get_json()
    reason = data.get('reason', 'User enabled by admin')
    
    user = User.find_by_uid(uid)
    if not user:
        return jsonify(error='User not found'), 404
    
    user.enable_user(reason)
    user.save()
    
    return jsonify(success=True, message='User enabled successfully')

@admin_bp.route("/meals/<meal_id>", methods=["DELETE"])
def delete_meal(meal_id):
    """Delete a meal"""
    try:
        success = UserMeal.delete_meal(meal_id)
        if success:
            return jsonify(
                status='success',
                message='Meal deleted successfully'
            ), 200
        else:
            return jsonify(
                status='error',
                error='Meal not found'
            ), 404
    except Exception as e:
        logging.error(f"Error deleting meal: {str(e)}")
        return jsonify(status='error', error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# NEW ADMIN ENDPOINTS — Dashboard, Risk, Trackers, Physicians, etc.
# ═══════════════════════════════════════════════════════════════════════════

# ─── Dashboard ────────────────────────────────────────────────────────────
admin_bp.add_url_rule("/risk/distribution", view_func=get_risk_distribution, methods=["GET"])
admin_bp.add_url_rule("/tracker/adoption", view_func=get_tracker_adoption, methods=["GET"])
admin_bp.add_url_rule("/consultations/summary", view_func=get_consultations_summary, methods=["GET"])
admin_bp.add_url_rule("/recent-activity", view_func=get_recent_activity, methods=["GET"])

# ─── User Extended ────────────────────────────────────────────────────────
admin_bp.add_url_rule("/users/<uid>/risk-overview", view_func=get_user_risk_overview, methods=["GET"])
admin_bp.add_url_rule("/users/<uid>/trackers", view_func=get_user_trackers, methods=["GET"])
admin_bp.add_url_rule("/users/<uid>/assessment", view_func=get_user_assessment, methods=["GET"])
admin_bp.add_url_rule("/users/<uid>/activity", view_func=get_user_activity, methods=["GET"])
admin_bp.add_url_rule("/users/<uid>/delete", view_func=delete_user, methods=["DELETE"])

# ─── Physician Management ─────────────────────────────────────────────────
admin_bp.add_url_rule("/physicians", view_func=get_physicians_list, methods=["GET"])
admin_bp.add_url_rule("/physicians/<physician_id>/details", view_func=get_physician_details, methods=["GET"])
admin_bp.add_url_rule("/physicians/<physician_id>/patients", view_func=get_physician_patients, methods=["GET"])
admin_bp.add_url_rule("/physicians/<physician_id>/consultations", view_func=get_physician_consultations, methods=["GET"])
admin_bp.add_url_rule("/physicians/<physician_id>/availability", view_func=get_physician_availability, methods=["GET"])

# ─── Risk & Assessments ──────────────────────────────────────────────────
admin_bp.add_url_rule("/risk/component-averages", view_func=get_risk_component_averages, methods=["GET"])
admin_bp.add_url_rule("/risk/trend", view_func=get_risk_trend, methods=["GET"])
admin_bp.add_url_rule("/risk/high-risk-patients", view_func=get_high_risk_patients, methods=["GET"])
admin_bp.add_url_rule("/assessments/stats", view_func=get_assessment_stats, methods=["GET"])
admin_bp.add_url_rule("/assessments/list", view_func=get_assessments_list, methods=["GET"])

# ─── Health Trackers ──────────────────────────────────────────────────────
admin_bp.add_url_rule("/trackers/food/stats", view_func=get_food_tracker_stats, methods=["GET"])
admin_bp.add_url_rule("/trackers/steps/stats", view_func=get_step_tracker_stats, methods=["GET"])
admin_bp.add_url_rule("/trackers/sleep/stats", view_func=get_sleep_tracker_stats, methods=["GET"])
admin_bp.add_url_rule("/trackers/smoking/stats", view_func=get_smoking_tracker_stats, methods=["GET"])
admin_bp.add_url_rule("/trackers/alcohol/stats", view_func=get_alcohol_tracker_stats, methods=["GET"])

# ─── Meals Extended ───────────────────────────────────────────────────────
admin_bp.add_url_rule("/meals/stats", view_func=get_meals_stats, methods=["GET"])
admin_bp.add_url_rule("/meals/nutrient-trends", view_func=get_meals_nutrient_trends, methods=["GET"])
admin_bp.add_url_rule("/meals/browse", view_func=browse_meals, methods=["GET"])

# ─── Consultations & Telehealth ──────────────────────────────────────────
admin_bp.add_url_rule("/consultations", view_func=get_consultations_list, methods=["GET"])
admin_bp.add_url_rule("/consultations/<consultation_id>", view_func=get_consultation_detail, methods=["GET"])
admin_bp.add_url_rule("/appointments", view_func=get_appointments_list, methods=["GET"])
admin_bp.add_url_rule("/prescriptions", view_func=get_prescriptions_list, methods=["GET"])

# ─── Chat & Communication ────────────────────────────────────────────────
admin_bp.add_url_rule("/chat/stats", view_func=get_chat_stats, methods=["GET"])
admin_bp.add_url_rule("/chat/conversations", view_func=get_chat_conversations, methods=["GET"])
admin_bp.add_url_rule("/chat/conversations/<conversation_id>/messages", view_func=get_conversation_messages, methods=["GET"])

# ─── AI & Chatbot ─────────────────────────────────────────────────────────
admin_bp.add_url_rule("/chatbot/stats", view_func=get_chatbot_stats, methods=["GET"])
admin_bp.add_url_rule("/chatbot/conversations", view_func=get_chatbot_conversations, methods=["GET"])
admin_bp.add_url_rule("/ai/food-analysis-stats", view_func=get_ai_food_analysis_stats, methods=["GET"])

# ─── System & Services ───────────────────────────────────────────────────
admin_bp.add_url_rule("/system/health", view_func=get_system_health, methods=["GET"])
admin_bp.add_url_rule("/system/database-stats", view_func=get_database_stats, methods=["GET"])
admin_bp.add_url_rule("/system/config", view_func=get_platform_config, methods=["GET"])
admin_bp.add_url_rule("/system/logs", view_func=get_system_logs, methods=["GET"])
