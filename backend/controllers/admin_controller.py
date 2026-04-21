"""
Admin Controller - Comprehensive admin dashboard endpoints
Provides analytics, monitoring, and management for the GlycoFit platform.
"""

from flask import request, jsonify
from config.database import get_db
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import math

# ─── HELPERS ──────────────────────────────────────────────────────────────

def _safe_str(val):
    """Convert ObjectId or other types to string safely."""
    if isinstance(val, ObjectId):
        return str(val)
    return str(val) if val else None

def _parse_date_range(default_days=30):
    """Parse start/end from query params, defaulting to last N days."""
    start_str = request.args.get('start')
    end_str = request.args.get('end')
    now = datetime.utcnow()
    if start_str and end_str:
        try:
            start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            return start, end
        except Exception:
            pass
    return now - timedelta(days=default_days), now

def _user_display(user_doc):
    """Get display name from user document."""
    first = user_doc.get('first_name', '')
    last = user_doc.get('last_name', '')
    return f"{first} {last}".strip() or user_doc.get('email', 'Unknown')


# ═══════════════════════════════════════════════════════════════════════════
# TAB 1 — DASHBOARD ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

def get_risk_distribution():
    """GET /admin/risk/distribution — Count of users per overall risk category.
    
    The active meta-ensemble lifestyle ML model outputs three categories: low, moderate, high.
    Legacy records may still contain very_high; these are folded into 'high' for consistency.
    """
    try:
        db = get_db()
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$user_id",
                "latest": {"$first": "$$ROOT"}
            }},
            {"$group": {
                "_id": "$latest.overall_risk_category",
                "count": {"$sum": 1}
            }}
        ]
        agg = list(db.overall_risk_assessments.aggregate(pipeline))
        raw_dist = {item['_id']: item['count'] for item in agg if item['_id']}

        # Fold legacy very_high records into high so the admin chart stays aligned
        # with the 3-class ML model output.
        distribution = {
            'low': raw_dist.get('low', 0),
            'moderate': raw_dist.get('moderate', 0),
            'high': raw_dist.get('high', 0) + raw_dist.get('very_high', 0),
        }

        total_assessed = sum(distribution.values())
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})

        return jsonify({
            'low': distribution['low'],
            'moderate': distribution['moderate'],
            'high': distribution['high'],
            'distribution': distribution,
            'total': total_assessed,
            'total_assessed': total_assessed,
            'total_users': total_users,
            'unassessed': max(0, total_users - total_assessed)
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in risk distribution: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_tracker_adoption():
    """GET /admin/tracker/adoption — Count of baselines per tracker type."""
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})

        adoption = {
            'food': db.food_baseline_assessments.count_documents({}),
            'sleep': db.sleep_baselines.count_documents({}),
            'steps': db.step_baselines.count_documents({}),
            'smoking': db.smoking_baselines.count_documents({}),
            'alcohol': db.alcohol_baselines.count_documents({}),
        }

        return jsonify({
            'adoption': adoption,
            'total_users': total_users
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in tracker adoption: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_consultations_summary():
    """GET /admin/consultations/summary — Consultation counts by status."""
    try:
        db = get_db()
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        agg = list(db.consultations.aggregate(pipeline))
        by_status = {item['_id']: item['count'] for item in agg if item['_id']}

        # Average rating
        rating_pipeline = [
            {"$match": {"rating": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]
        rating_agg = list(db.consultations.aggregate(rating_pipeline))
        avg_rating = round(rating_agg[0]['avg_rating'], 2) if rating_agg else 0
        rated_count = rating_agg[0]['count'] if rating_agg else 0

        return jsonify({
            'by_status': by_status,
            'total': sum(by_status.values()),
            'avg_rating': avg_rating,
            'rated_count': rated_count
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in consultations summary: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_recent_activity():
    """GET /admin/recent-activity — Recent registrations, consultations, risk changes."""
    try:
        db = get_db()
        limit = request.args.get('limit', 5, type=int)

        # Recent registrations
        recent_users = list(db.users.find(
            {"role": {"$in": ["user", "admin"]}},
            {"first_name": 1, "last_name": 1, "email": 1, "role": 1, "created_at": 1}
        ).sort("created_at", -1).limit(limit))

        registrations = [{
            'id': _safe_str(u['_id']),
            'name': _user_display(u),
            'email': u.get('email'),
            'role': u.get('role'),
            'date': u.get('created_at').isoformat() if u.get('created_at') else None
        } for u in recent_users]

        # Recent consultations
        recent_consults = list(db.consultations.find().sort("created_at", -1).limit(limit))
        consultations = []
        for c in recent_consults:
            patient = db.users.find_one({"_id": c.get('patient_id')}, {"first_name": 1, "last_name": 1}) if c.get('patient_id') else None
            physician = db.users.find_one({"_id": c.get('physician_id')}, {"first_name": 1, "last_name": 1}) if c.get('physician_id') else None
            consultations.append({
                'id': _safe_str(c['_id']),
                'patient_name': _user_display(patient) if patient else 'Unknown',
                'physician_name': _user_display(physician) if physician else 'Unknown',
                'status': c.get('status'),
                'date': c.get('created_at').isoformat() if c.get('created_at') else None
            })

        # High-risk alerts (recently assessed as high/very_high)
        high_risk = list(db.overall_risk_assessments.find(
            {"overall_risk_category": {"$in": ["high", "very_high"]}}
        ).sort("created_at", -1).limit(limit))

        alerts = []
        for r in high_risk:
            user = db.users.find_one({"_id": ObjectId(r['user_id'])}, {"first_name": 1, "last_name": 1}) if r.get('user_id') else None
            alerts.append({
                'user_id': _safe_str(r.get('user_id')),
                'user_name': _user_display(user) if user else 'Unknown',
                'risk_category': r.get('overall_risk_category'),
                'risk_score': r.get('overall_risk_score'),
                'date': r.get('created_at').isoformat() if r.get('created_at') else None
            })

        return jsonify({
            'recent_registrations': registrations,
            'recent_consultations': consultations,
            'high_risk_alerts': alerts
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in recent activity: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 2 — USER MANAGEMENT (EXTENDED)
# ═══════════════════════════════════════════════════════════════════════════

def get_user_risk_overview(uid):
    """GET /admin/users/<uid>/risk-overview — Overall risk + component scores."""
    try:
        db = get_db()
        from models.user import User
        user = User.find_by_uid(uid)
        if not user:
            user = User.find_by_id(uid)
        if not user:
            return jsonify(error='User not found'), 404

        user_id_str = str(user._id)

        # Latest overall risk
        latest_risk = db.overall_risk_assessments.find_one(
            {"user_id": user_id_str},
            sort=[("created_at", -1)]
        )

        if not latest_risk:
            return jsonify({
                'has_assessment': False,
                'message': 'No risk assessment found for this user'
            })

        # Risk history (last 10)
        risk_history = list(db.overall_risk_assessments.find(
            {"user_id": user_id_str}
        ).sort("created_at", -1).limit(10))

        history = [{
            'date': r.get('created_at').isoformat() if r.get('created_at') else None,
            'overall_score': r.get('overall_risk_score'),
            'category': r.get('overall_risk_category'),
            'confidence': r.get('data_confidence', {}).get('confidence_level')
        } for r in risk_history]

        return jsonify({
            'has_assessment': True,
            'overall_risk_score': latest_risk.get('overall_risk_score'),
            'overall_risk_category': latest_risk.get('overall_risk_category'),
            'confidence': latest_risk.get('data_confidence', {}),
            'component_scores': latest_risk.get('component_scores', {}),
            'primary_risk_factors': latest_risk.get('primary_risk_factors', []),
            'protective_factors': latest_risk.get('protective_factors', []),
            'key_improvements': latest_risk.get('key_improvements', []),
            'trend_prediction': latest_risk.get('trend_prediction', {}),
            'risk_history': history,
            'assessed_at': latest_risk.get('created_at').isoformat() if latest_risk.get('created_at') else None
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in user risk overview: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_user_trackers(uid):
    """GET /admin/users/<uid>/trackers — All tracker baselines and recent data."""
    try:
        db = get_db()
        from models.user import User
        user = User.find_by_uid(uid)
        if not user:
            user = User.find_by_id(uid)
        if not user:
            return jsonify(error='User not found'), 404

        user_id_str = str(user._id)
        user_obj_id = ObjectId(user_id_str)
        trackers = {}

        # Food baseline — stored with ObjectId user_id
        food_bl = db.food_baseline_assessments.find_one({"user_id": user_obj_id})
        raw_score = food_bl.get('baseline_risk_score') if food_bl else None
        if raw_score is not None:
            if raw_score <= 30:
                food_risk_level = 'low'
            elif raw_score <= 60:
                food_risk_level = 'moderate'
            elif raw_score <= 80:
                food_risk_level = 'high'
            else:
                food_risk_level = 'very_high'
        else:
            food_risk_level = None
        trackers['food'] = {
            'has_baseline': food_bl is not None,
            'baseline_risk_score': round(raw_score, 1) if raw_score is not None else None,
            'baseline_risk_level': food_risk_level,
        }

        # Step baseline & step_metrics (precomputed aggregates)
        step_bl = db.step_baselines.find_one({"user_id": user_id_str})
        step_metrics_doc = db.step_metrics.find_one({"user_id": user_id_str})
        trackers['steps'] = {
            'has_baseline': step_bl is not None,
            'avg_daily_steps_7d': round(step_metrics_doc.get('avg_steps_7d') or 0) if step_metrics_doc else 0,
            'activity_level': step_bl.get('baseline_activity_level') if step_bl else None,
            'recent_records': (step_metrics_doc.get('days_with_data_7d') or 0) if step_metrics_doc else 0,
        }

        # Sleep baseline & recent
        sleep_bl = db.sleep_baselines.find_one({"user_id": user_id_str})
        recent_sleep = list(db.sleep_daily_records.find(
            {"user_id": user_id_str}
        ).sort("date", -1).limit(7))
        avg_sleep_7d = sum(r.get('sleep_duration_hours', 0) for r in recent_sleep) / max(len(recent_sleep), 1)
        trackers['sleep'] = {
            'has_baseline': sleep_bl is not None,
            'avg_sleep_hours_7d': round(avg_sleep_7d, 1) if recent_sleep else None,
            'baseline_avg': sleep_bl.get('baseline_avg_sleep_hours') if sleep_bl else None,
            'recent_records': len(recent_sleep),
        }

        # Smoking baseline
        smoking_bl = db.smoking_baselines.find_one({"user_id": user_id_str})
        trackers['smoking'] = {
            'has_baseline': smoking_bl is not None,
            'status': smoking_bl.get('smoking_status') if smoking_bl else None,
            'cigarettes_per_day': smoking_bl.get('typical_cigarettes_per_day') if smoking_bl else None,
            'pack_years': smoking_bl.get('years_smoked') if smoking_bl else None,
        }

        # Alcohol baseline — drinks_per_week is not stored directly, compute it
        alcohol_bl = db.alcohol_baselines.find_one({"user_id": user_id_str})
        if alcohol_bl:
            days_pw = alcohol_bl.get('baseline_drinking_days_per_week') or 0
            drinks_poc = alcohol_bl.get('baseline_drinks_per_occasion') or 0
            drinks_per_week = round(days_pw * drinks_poc, 2)
        else:
            drinks_per_week = None
        trackers['alcohol'] = {
            'has_baseline': alcohol_bl is not None,
            'drinks_per_week': drinks_per_week,
            'binge_frequency': alcohol_bl.get('baseline_binge_frequency_per_month') if alcohol_bl else None,
        }

        return jsonify(trackers)
    except Exception as e:
        logging.error(f"[ADMIN] Error in user trackers: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_user_assessment(uid):
    """GET /admin/users/<uid>/assessment — Diabetes assessment answers + prediction."""
    try:
        db = get_db()
        from models.user import User
        user = User.find_by_uid(uid)
        if not user:
            user = User.find_by_id(uid)
        if not user:
            return jsonify(error='User not found'), 404

        # userId in diabetes_assessments is stored as ObjectId(_id of user)
        assessment = db.diabetes_assessments.find_one(
            {"userId": user._id},
            sort=[("createdAt", -1)]
        )

        if not assessment:
            return jsonify({'has_assessment': False})

        prediction = assessment.get('prediction') or {}
        created_at = assessment.get('createdAt')

        return jsonify({
            'has_assessment': True,
            'answers': assessment.get('answers', {}),
            'prediction': prediction,
            'risk_level': prediction.get('risk_level'),
            'probability': prediction.get('probability'),
            'confidence': prediction.get('confidence'),
            'assessed_at': created_at.isoformat() if created_at else None
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in user assessment: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_user_activity(uid):
    """GET /admin/users/<uid>/activity — Health Connect + activity data."""
    try:
        db = get_db()
        from models.user import User
        user = User.find_by_uid(uid)
        if not user:
            user = User.find_by_id(uid)
        if not user:
            return jsonify(error='User not found'), 404

        # user_activities stores field "uid" = Firebase UID (set by activity_controller)
        # health_data stores field "user_id" = Firebase UID (set by health_data_controller)
        firebase_uid = user.uid

        # Activity records — field is "uid", value is Firebase UID
        activities = list(db.user_activities.find({
            "uid": firebase_uid,
            "activity_type": "daily"
        }).sort("date", -1).limit(30))

        activity_data = []
        for a in activities:
            raw_date = a.get('date')
            if raw_date is None:
                date_str = None
            elif hasattr(raw_date, 'isoformat'):
                date_str = raw_date.isoformat()
            else:
                date_str = str(raw_date)
            activity_data.append({
                'date': date_str,
                'steps': a.get('steps'),
                'distance': a.get('distance'),
                'calories_burned': a.get('active_calories'),  # stored as active_calories
                'active_minutes': a.get('active_minutes'),
            })

        # Health data (Health Connect synced data) — field "user_id" = Firebase UID
        health_records = list(db.health_data.find({
            "user_id": firebase_uid,
        }).sort("created_at", -1).limit(20))

        health_data = [{
            'id': _safe_str(h['_id']),
            'type': h.get('data_type'),
            'value': h.get('value'),
            'unit': h.get('unit'),
            'source': h.get('source'),
            'date': h.get('created_at').isoformat() if h.get('created_at') else None
        } for h in health_records]

        return jsonify({
            'activities': activity_data,
            'health_data': health_data,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in user activity: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def delete_user(uid):
    """DELETE /admin/users/<uid> — Full user deletion with cascade."""
    try:
        db = get_db()
        from models.user import User
        user = User.find_by_uid(uid)
        if not user:
            user = User.find_by_id(uid)
        if not user:
            return jsonify(error='User not found'), 404

        user_id = user._id
        user_id_str = str(user_id)

        deleted_counts = {}

        # Delete related data
        collections_to_clean = [
            ('user_meals', 'user_id', user_id),
            ('overall_risk_assessments', 'user_id', user_id_str),
            ('diabetes_assessments', 'user_id', user_id_str),
            ('food_baseline_assessments', 'user_id', user_id_str),
            ('sleep_baselines', 'user_id', user_id_str),
            ('sleep_daily_records', 'user_id', user_id_str),
            ('step_baselines', 'user_id', user_id_str),
            ('step_daily_records', 'user_id', user_id_str),
            ('smoking_baselines', 'user_id', user_id_str),
            ('smoking_daily_records', 'user_id', user_id_str),
            ('alcohol_baselines', 'user_id', user_id_str),
            ('alcohol_daily_records', 'user_id', user_id_str),
            ('chatbot_messages', 'user_id', user_id),
            ('health_data', 'user_id', user_id_str),
            ('user_activities', 'user_id', user_id_str),
        ]

        for coll_name, field, val in collections_to_clean:
            try:
                result = db[coll_name].delete_many({field: val})
                deleted_counts[coll_name] = result.deleted_count
            except Exception as e:
                logging.warning(f"[ADMIN] Could not clean {coll_name}: {e}")
                deleted_counts[coll_name] = 0

        # Delete user record
        db.users.delete_one({"_id": user_id})

        # Try to delete from Firebase
        try:
            from firebase_admin import auth
            auth.delete_user(user.uid)
            deleted_counts['firebase'] = 1
        except Exception as fe:
            logging.warning(f"[ADMIN] Could not delete Firebase user: {fe}")
            deleted_counts['firebase'] = 0

        logging.info(f"[ADMIN] Deleted user {uid} with cascaded data: {deleted_counts}")

        return jsonify({
            'success': True,
            'message': 'User and related data deleted successfully',
            'deleted_counts': deleted_counts
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error deleting user: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 3 — PHYSICIAN MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

def get_physicians_list():
    """GET /admin/physicians — Dedicated physician list with professional details."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 50, type=int)
        search = request.args.get('search', '').strip()

        query = {"role": "physician"}
        if search:
            query["$or"] = [
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
            ]

        users = list(db.users.find(query).skip(skip).limit(limit))
        total = db.users.count_documents(query)

        physicians = []
        for u in users:
            uid = u.get('uid')
            user_id_str = str(u['_id'])

            # Get physician profile (stored with user_id as ObjectId)
            physician_profile = db.physicians.find_one({"user_id": u['_id']}) or \
                                db.physicians.find_one({"user_id": user_id_str}) or \
                                db.physicians.find_one({"uid": uid}) or {}
            phys_oid = physician_profile.get('_id')

            # Count patients — physician_id in patient_physicians references Physician._id
            phys_or = [{"physician_id": user_id_str}, {"physician_id": uid}]
            if phys_oid:
                phys_or += [{"physician_id": phys_oid}, {"physician_id": str(phys_oid)}]
            patient_count = db.patient_physicians.count_documents({
                "$or": phys_or,
                "status": "active"
            })

            # Count consultations — physician_id in consultations references Physician._id
            consult_or = [{"physician_id": u['_id']}, {"physician_id": user_id_str}]
            if phys_oid:
                consult_or += [{"physician_id": phys_oid}, {"physician_id": str(phys_oid)}]
            consult_count = db.consultations.count_documents({"$or": consult_or})

            from models.user import User
            user_obj = User.from_dict(u)
            user_obj._id = u['_id']

            physicians.append({
                **user_obj.to_safe_dict(),
                'specialization': physician_profile.get('specialization'),
                'license_number': physician_profile.get('license_number'),
                'consultation_fee': physician_profile.get('consultation_fee'),
                'years_of_experience': physician_profile.get('years_of_experience'),
                'languages': physician_profile.get('languages', []),
                'bio': physician_profile.get('bio'),
                'total_patients': patient_count,
                'total_consultations': consult_count,
                'is_available': physician_profile.get('is_active', False),
            })

        return jsonify({
            'physicians': physicians,
            'total': total,
            'skip': skip,
            'limit': limit
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error fetching physicians: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_physician_details(physician_id):
    """GET /admin/physicians/<id>/details — Full physician profile + stats."""
    try:
        db = get_db()
        from models.user import User

        user = User.find_by_uid(physician_id)
        if not user:
            user = User.find_by_id(physician_id)
        if not user:
            return jsonify(error='Physician not found'), 404

        user_id_str = str(user._id)

        # Professional profile (stored with user_id as ObjectId)
        profile = db.physicians.find_one({"user_id": user._id}) or \
                  db.physicians.find_one({"user_id": user_id_str}) or \
                  db.physicians.find_one({"uid": user.uid}) or {}
        phys_oid = profile.get('_id')

        # Build physician_id $or clauses covering all storage variants
        phys_or = [{"physician_id": user._id}, {"physician_id": user_id_str}]
        if phys_oid:
            phys_or += [{"physician_id": phys_oid}, {"physician_id": str(phys_oid)}]

        # Consultation stats
        consult_pipeline = [
            {"$match": {"$or": phys_or}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        consult_agg = list(db.consultations.aggregate(consult_pipeline))
        consult_by_status = {item['_id']: item['count'] for item in consult_agg if item['_id']}

        # Average rating
        rating_pipeline = [
            {"$match": {
                "$or": phys_or,
                "rating": {"$exists": True, "$ne": None}
            }},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]
        rating_agg = list(db.consultations.aggregate(rating_pipeline))

        # Patient count — physician_id in patient_physicians references Physician._id
        patient_count = db.patient_physicians.count_documents({
            "$or": phys_or,
            "status": "active"
        })

        # Prescriptions count
        rx_count = db.prescriptions.count_documents({"$or": phys_or})

        return jsonify({
            'user': user.to_safe_dict(),
            'profile': {
                'specialization': profile.get('specialization'),
                'license_number': profile.get('license_number'),
                'consultation_fee': profile.get('consultation_fee'),
                'years_of_experience': profile.get('years_of_experience'),
                'languages': profile.get('languages', []),
                'bio': profile.get('bio'),
                'is_available': profile.get('is_active', False),
            },
            'stats': {
                'total_patients': patient_count,
                'consultations_by_status': consult_by_status,
                'total_consultations': sum(consult_by_status.values()),
                'avg_rating': round(rating_agg[0]['avg'], 2) if rating_agg else 0,
                'rated_consultations': rating_agg[0]['count'] if rating_agg else 0,
                'prescriptions_issued': rx_count,
            }
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error fetching physician details: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_physician_patients(physician_id):
    """GET /admin/physicians/<id>/patients — Patient connections."""
    try:
        db = get_db()
        from models.user import User

        user = User.find_by_uid(physician_id)
        if not user:
            user = User.find_by_id(physician_id)
        if not user:
            return jsonify(error='Physician not found'), 404

        # physician_id in patient_physicians references Physician._id (profile), not user._id
        physician_profile = db.physicians.find_one({"user_id": user._id}) or \
                            db.physicians.find_one({"user_id": str(user._id)}) or \
                            db.physicians.find_one({"uid": user.uid})
        phys_oid = physician_profile['_id'] if physician_profile else None

        or_clauses = [{"physician_id": str(user._id)}, {"physician_id": user.uid}]
        if phys_oid:
            or_clauses += [{"physician_id": phys_oid}, {"physician_id": str(phys_oid)}]

        connections = list(db.patient_physicians.find({"$or": or_clauses}).sort("created_at", -1))

        patients = []
        for conn in connections:
            patient_id = conn.get('patient_id')
            patient = None
            if patient_id:
                try:
                    patient = db.users.find_one({"_id": ObjectId(patient_id)})
                except Exception:
                    patient = db.users.find_one({"uid": patient_id})

            # Get patient risk
            risk = None
            if patient:
                risk_doc = db.overall_risk_assessments.find_one(
                    {"user_id": str(patient['_id'])},
                    sort=[("created_at", -1)]
                )
                if risk_doc:
                    risk = {
                        'category': risk_doc.get('overall_risk_category'),
                        'score': risk_doc.get('overall_risk_score')
                    }

            patients.append({
                'connection_id': _safe_str(conn['_id']),
                'patient_id': _safe_str(patient['_id']) if patient else None,
                'patient_name': _user_display(patient) if patient else 'Unknown',
                'patient_email': patient.get('email') if patient else None,
                'diagnosis_status': patient.get('diagnosis_status') if patient else None,
                'risk': risk,
                'status': conn.get('status'),
                'connected_at': conn.get('created_at').isoformat() if conn.get('created_at') else None,
            })

        return jsonify({'patients': patients, 'total': len(patients)})
    except Exception as e:
        logging.error(f"[ADMIN] Error fetching physician patients: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_physician_consultations(physician_id):
    """GET /admin/physicians/<id>/consultations — Consultation history."""
    try:
        db = get_db()
        from models.user import User

        user = User.find_by_uid(physician_id)
        if not user:
            user = User.find_by_id(physician_id)
        if not user:
            return jsonify(error='Physician not found'), 404

        # physician_id in consultations references Physician._id (profile), not user._id
        physician_profile = db.physicians.find_one({"user_id": user._id}) or \
                            db.physicians.find_one({"user_id": str(user._id)}) or \
                            db.physicians.find_one({"uid": user.uid})
        phys_oid = physician_profile['_id'] if physician_profile else None

        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
        status_filter = request.args.get('status')

        or_clauses = [{"physician_id": user._id}, {"physician_id": str(user._id)}]
        if phys_oid:
            or_clauses += [{"physician_id": phys_oid}, {"physician_id": str(phys_oid)}]
        query = {"$or": or_clauses}
        if status_filter:
            query['status'] = status_filter

        consults = list(db.consultations.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.consultations.count_documents(query)

        results = []
        for c in consults:
            p_id = c.get('patient_id')
            patient = None
            if p_id:
                if isinstance(p_id, ObjectId):
                    patient = db.users.find_one({"_id": p_id})
                else:
                    try:
                        patient = db.users.find_one({"_id": ObjectId(str(p_id))})
                    except Exception:
                        patient = db.users.find_one({"uid": str(p_id)})
            results.append({
                'id': _safe_str(c['_id']),
                'patient_name': _user_display(patient) if patient else 'Unknown',
                'status': c.get('status'),
                'mode': c.get('consultation_type') or c.get('mode'),
                'rating': c.get('patient_rating') or c.get('rating'),
                'scheduled_date': c.get('scheduled_date').isoformat() if c.get('scheduled_date') else None,
                'diagnosis': c.get('diagnosis'),
                'treatment_plan': c.get('treatment_plan'),
                'meeting_link': c.get('meeting_link'),
                'date': c.get('created_at').isoformat() if c.get('created_at') else None,
            })

        return jsonify({'consultations': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error fetching physician consultations: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_physician_availability(physician_id):
    """GET /admin/physicians/<id>/availability — Availability schedule."""
    try:
        db = get_db()
        from models.user import User

        user = User.find_by_uid(physician_id)
        if not user:
            user = User.find_by_id(physician_id)
        if not user:
            return jsonify(error='Physician not found'), 404

        # physician_id in physician_availability references Physician._id (profile), not user._id
        physician_profile = db.physicians.find_one({"user_id": user._id}) or \
                            db.physicians.find_one({"user_id": str(user._id)}) or \
                            db.physicians.find_one({"uid": user.uid})
        phys_oid = physician_profile['_id'] if physician_profile else None

        or_clauses = [{"physician_id": str(user._id)}, {"physician_id": user.uid}]
        if phys_oid:
            or_clauses += [{"physician_id": phys_oid}, {"physician_id": str(phys_oid)}]

        availability = list(db.physician_availability.find({"$or": or_clauses}))

        schedule = [{
            'day': a.get('day_of_week'),
            'start_time': a.get('start_time'),
            'end_time': a.get('end_time'),
            'slot_duration': a.get('slot_duration'),
            'is_active': a.get('is_active', True),
        } for a in availability]

        return jsonify({'availability': schedule})
    except Exception as e:
        logging.error(f"[ADMIN] Error fetching physician availability: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 4 — RISK & ASSESSMENTS
# ═══════════════════════════════════════════════════════════════════════════

def get_risk_component_averages():
    """GET /admin/risk/component-averages — Average per-component risk scores."""
    try:
        db = get_db()
        
        # Get latest assessment per user
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$user_id",
                "doc": {"$first": "$$ROOT"}
            }},
            {"$replaceRoot": {"newRoot": "$doc"}}
        ]
        latest_assessments = list(db.overall_risk_assessments.aggregate(pipeline))

        if not latest_assessments:
            return jsonify({
                'component_averages': {},
                'total_assessed': 0,
                'highest_risk_component': None
            })

        # Aggregate component scores
        # Each component value is a nested dict: {raw_score, weighted_score, has_data, ...}
        # Skip demographic-only components (age, sex) as they aren't actionable
        SKIP_COMPONENTS = {'age', 'sex'}
        component_sums = {}
        component_counts = {}
        for assessment in latest_assessments:
            components = assessment.get('component_scores', {})
            for key, val in components.items():
                if key in SKIP_COMPONENTS:
                    continue
                if isinstance(val, dict):
                    raw = val.get('raw_score', 0)
                    if isinstance(raw, (int, float)) and val.get('has_data', False):
                        component_sums[key] = component_sums.get(key, 0) + raw
                        component_counts[key] = component_counts.get(key, 0) + 1
                elif isinstance(val, (int, float)):
                    component_sums[key] = component_sums.get(key, 0) + val
                    component_counts[key] = component_counts.get(key, 0) + 1

        averages = {}
        for key in component_sums:
            averages[key] = round(component_sums[key] / component_counts[key], 2) if component_counts[key] > 0 else 0

        highest = max(averages, key=averages.get) if averages else None

        return jsonify({
            'component_averages': averages,
            'total_assessed': len(latest_assessments),
            'highest_risk_component': highest
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in risk component averages: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_risk_trend():
    """GET /admin/risk/trend — Weekly average risk scores over time."""
    try:
        db = get_db()
        start, end = _parse_date_range(90)

        pipeline = [
            {"$match": {"created_at": {"$gte": start, "$lte": end}}},
            {"$group": {
                "_id": {
                    "year": {"$year": "$created_at"},
                    "week": {"$week": "$created_at"}
                },
                "avg_score": {"$avg": "$overall_risk_score"},
                "count": {"$sum": 1},
                "min_date": {"$min": "$created_at"}
            }},
            {"$sort": {"min_date": 1}}
        ]
        agg = list(db.overall_risk_assessments.aggregate(pipeline))

        trend = [{
            'week': f"{item['_id']['year']}-W{item['_id']['week']:02d}",
            'avg_score': round(item['avg_score'], 2),
            'assessments': item['count'],
            'date': item['min_date'].isoformat() if item.get('min_date') else None
        } for item in agg]

        return jsonify({'trend': trend})
    except Exception as e:
        logging.error(f"[ADMIN] Error in risk trend: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_high_risk_patients():
    """GET /admin/risk/high-risk-patients — Paginated high-risk users.
    
    Matches both 'high' and legacy 'very_high' categories so no data is lost
    when transitioning from the old rule-based model to the current ML model.
    """
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)

        # Get latest assessment per user, filtered to high risk
        # (very_high is a legacy category; fold it in for backward compatibility)
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$user_id", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$match": {"overall_risk_category": {"$in": ["high", "very_high"]}}},
            {"$sort": {"overall_risk_score": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        results = list(db.overall_risk_assessments.aggregate(pipeline))

        # Count total
        count_pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$user_id", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$match": {"overall_risk_category": {"$in": ["high", "very_high"]}}},
            {"$count": "total"}
        ]
        count_result = list(db.overall_risk_assessments.aggregate(count_pipeline))
        total = count_result[0]['total'] if count_result else 0

        patients = []
        for r in results:
            user = db.users.find_one({"_id": ObjectId(r['user_id'])}) if r.get('user_id') else None

            # Check physician connection
            physician_name = None
            if user:
                conn = db.patient_physicians.find_one({
                    "patient_id": str(user['_id']),
                    "status": "active"
                })
                if conn:
                    phys = db.users.find_one({"_id": ObjectId(conn['physician_id'])}) if conn.get('physician_id') else None
                    if not phys:
                        phys = db.users.find_one({"uid": conn.get('physician_id')})
                    physician_name = _user_display(phys) if phys else None

            patients.append({
                'user_id': r.get('user_id'),
                'name': _user_display(user) if user else 'Unknown',
                'email': user.get('email') if user else None,
                'overall_risk_score': r.get('overall_risk_score'),
                'risk_category': r.get('overall_risk_category'),
                'confidence': r.get('data_confidence', {}).get('confidence_level'),
                'primary_risk_factors': r.get('primary_risk_factors', [])[:3],
                'trend': r.get('trend_prediction', {}).get('trend'),
                'physician': physician_name,
                'last_assessed': r.get('created_at').isoformat() if r.get('created_at') else None
            })

        return jsonify({'patients': patients, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error in high-risk patients: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_assessment_stats():
    """GET /admin/assessments/stats — Diabetes assessment completion stats.
    
    NOTE: diabetes_assessments documents use camelCase fields:
      userId (ObjectId), createdAt, updatedAt
      prediction.risk_level, prediction.probability, prediction.confidence
    """
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})

        # Total assessments (one per user — model enforces upsert)
        total_assessments = db.diabetes_assessments.count_documents({})

        # Unique users with assessments (field is userId, not user_id)
        unique_assessed = len(db.diabetes_assessments.distinct("userId"))

        # Assessments submitted this calendar month
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        this_month = db.diabetes_assessments.count_documents(
            {"createdAt": {"$gte": month_start}}
        )

        # Risk level distribution — stored at prediction.risk_level, NOT root risk_level
        pipeline = [
            {"$sort": {"createdAt": -1}},
            {"$group": {"_id": "$userId", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$group": {"_id": "$prediction.risk_level", "count": {"$sum": 1}}}
        ]
        agg = list(db.diabetes_assessments.aggregate(pipeline))
        risk_distribution = {item['_id']: item['count'] for item in agg if item['_id']}

        high_risk_count = (
            risk_distribution.get('high', 0) + risk_distribution.get('very_high', 0)
        )

        # Average probability — stored at prediction.probability (0-1 float)
        prob_pipeline = [
            {"$sort": {"createdAt": -1}},
            {"$group": {"_id": "$userId", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$match": {"prediction.probability": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": None, "avg_prob": {"$avg": "$prediction.probability"}}}
        ]
        prob_result = list(db.diabetes_assessments.aggregate(prob_pipeline))
        avg_probability = prob_result[0]['avg_prob'] if prob_result else 0
        # probability is 0-1; convert to percentage for the UI
        avg_score = round(avg_probability * 100, 1)

        return jsonify({
            'total_users': total_users,
            'total_assessments': total_assessments,
            'assessed_users': unique_assessed,
            'completion_rate': round(unique_assessed / total_users * 100, 1) if total_users > 0 else 0,
            'risk_distribution': risk_distribution,
            'high_risk_count': high_risk_count,
            'avg_probability': round(avg_probability, 4),
            'avg_score': avg_score,
            'this_month': this_month,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in assessment stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_assessments_list():
    """GET /admin/assessments/list — All diabetes assessments with user info.
    
    NOTE: diabetes_assessments documents use camelCase fields:
      userId (ObjectId), createdAt
      prediction.risk_level, prediction.probability, prediction.confidence
    """
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
        risk_filter = request.args.get('risk_level')

        # risk_level lives at prediction.risk_level, not at document root
        query = {}
        if risk_filter:
            query['prediction.risk_level'] = risk_filter

        assessments = list(db.diabetes_assessments.find(query).sort("createdAt", -1).skip(skip).limit(limit))
        total = db.diabetes_assessments.count_documents(query)

        results = []
        for a in assessments:
            # userId is stored as ObjectId directly
            user = None
            user_id_val = a.get('userId')
            if user_id_val:
                try:
                    user = db.users.find_one({"_id": user_id_val if isinstance(user_id_val, ObjectId) else ObjectId(str(user_id_val))})
                except Exception:
                    pass

            prediction = a.get('prediction') or {}
            created_at = a.get('createdAt')

            results.append({
                'id': _safe_str(a['_id']),
                'user_name': _user_display(user) if user else 'Unknown',
                'user_email': user.get('email') if user else None,
                'risk_level': prediction.get('risk_level'),
                'probability': prediction.get('probability'),
                'confidence': prediction.get('confidence'),
                'assessed_at': created_at.isoformat() if created_at else None
            })

        return jsonify({'assessments': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error in assessments list: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 5 — HEALTH TRACKERS
# ═══════════════════════════════════════════════════════════════════════════

def get_food_tracker_stats():
    """GET /admin/trackers/food/stats — Aggregated food tracking stats."""
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})
        baselines = db.food_baseline_assessments.count_documents({})

        # Average nutrients from recent meals
        nutrient_pipeline = [
            {"$match": {
                "meal_datetime": {"$gte": datetime.utcnow() - timedelta(days=30)}
            }},
            {"$group": {
                "_id": None,
                "avg_calories": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Calories", 0]}}},
                "avg_carbs": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Carbs (g)", 0]}}},
                "avg_protein": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Protein (g)", 0]}}},
                "avg_fat": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Fat (g)", 0]}}},
                "avg_fiber": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Dietary Fiber (g)", 0]}}},
                "avg_sugar": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Added Sugars (g)", 0]}}},
                "total_meals": {"$sum": 1}
            }}
        ]
        nutrient_agg = list(db.user_meals.aggregate(nutrient_pipeline))
        nutrients = nutrient_agg[0] if nutrient_agg else {}

        # Food type distribution
        type_pipeline = [
            {"$group": {"_id": "$food_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        type_agg = list(db.user_meals.aggregate(type_pipeline))
        food_types = {item['_id']: item['count'] for item in type_agg if item['_id']}

        # Risk distribution from baselines (derived from baseline_risk_score)
        risk_pipeline = [
            {"$match": {"baseline_risk_score": {"$exists": True, "$ne": None}}},
            {"$addFields": {
                "risk_level": {
                    "$switch": {
                        "branches": [
                            {"case": {"$lt": ["$baseline_risk_score", 30]}, "then": "low"},
                            {"case": {"$lt": ["$baseline_risk_score", 60]}, "then": "moderate"},
                            {"case": {"$lt": ["$baseline_risk_score", 80]}, "then": "high"},
                        ],
                        "default": "very_high"
                    }
                }
            }},
            {"$group": {"_id": "$risk_level", "count": {"$sum": 1}}}
        ]
        risk_agg = list(db.food_baseline_assessments.aggregate(risk_pipeline))
        risk_dist = {item['_id']: item['count'] for item in risk_agg if item['_id']}

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'avg_nutrients': {
                'calories': round(nutrients.get('avg_calories', 0), 1),
                'carbs': round(nutrients.get('avg_carbs', 0), 1),
                'protein': round(nutrients.get('avg_protein', 0), 1),
                'fat': round(nutrients.get('avg_fat', 0), 1),
                'fiber': round(nutrients.get('avg_fiber', 0), 1),
                'added_sugars': round(nutrients.get('avg_sugar', 0), 1),
            },
            'total_meals_30d': nutrients.get('total_meals', 0),
            'food_type_distribution': food_types,
            'risk_distribution': risk_dist,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in food tracker stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_step_tracker_stats():
    """GET /admin/trackers/steps/stats — Aggregated step tracking stats."""
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})
        baselines = db.step_baselines.count_documents({})

        # Average daily steps (last 30 days) — data is in user_activities (keyed by Firebase uid)
        cutoff = datetime.utcnow() - timedelta(days=30)
        step_pipeline = [
            {"$match": {
                "activity_type": "daily",
                "date": {"$gte": cutoff},
                "steps": {"$exists": True, "$gt": 0}
            }},
            {"$group": {
                "_id": None,
                "avg_steps": {"$avg": "$steps"},
                "total_records": {"$sum": 1},
                "goal_met": {"$sum": {"$cond": [{"$gte": ["$steps", 10000]}, 1, 0]}}
            }}
        ]
        step_agg = list(db.user_activities.aggregate(step_pipeline))
        stats = step_agg[0] if step_agg else {}

        # Activity level distribution from baselines (field is baseline_activity_level)
        level_pipeline = [
            {"$group": {"_id": "$baseline_activity_level", "count": {"$sum": 1}}}
        ]
        level_agg = list(db.step_baselines.aggregate(level_pipeline))
        levels = {item['_id']: item['count'] for item in level_agg if item['_id']}

        avg_steps = stats.get('avg_steps') or 0
        total_recs_s = stats.get('total_records') or 0
        goal_met = stats.get('goal_met') or 0

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'avg_daily_steps': round(avg_steps),
            'total_records_30d': total_recs_s,
            'goal_achievement_rate': round(goal_met / total_recs_s * 100, 1) if total_recs_s else 0,
            'activity_level_distribution': levels,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in step tracker stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_sleep_tracker_stats():
    """GET /admin/trackers/sleep/stats — Aggregated sleep tracking stats."""
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})
        baselines = db.sleep_baselines.count_documents({})

        # Average sleep hours (last 30 days)
        sleep_pipeline = [
            {"$match": {
                "date": {"$gte": (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')}
            }},
            {"$group": {
                "_id": None,
                "avg_hours": {"$avg": "$sleep_duration_hours"},
                "total_records": {"$sum": 1},
                "short_sleep": {"$sum": {"$cond": [{"$lt": ["$sleep_duration_hours", 6]}, 1, 0]}},
                "long_sleep": {"$sum": {"$cond": [{"$gt": ["$sleep_duration_hours", 9]}, 1, 0]}},
            }}
        ]
        sleep_agg = list(db.sleep_daily_records.aggregate(sleep_pipeline))
        stats = sleep_agg[0] if sleep_agg else {}

        total_recs = stats.get('total_records', 1) or 1

        # Source distribution
        source_pipeline = [
            {"$group": {"_id": "$source", "count": {"$sum": 1}}}
        ]
        source_agg = list(db.sleep_daily_records.aggregate(source_pipeline))
        sources = {item['_id']: item['count'] for item in source_agg if item['_id']}

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'avg_sleep_hours': round(stats.get('avg_hours', 0), 1),
            'total_records_30d': stats.get('total_records', 0),
            'short_sleepers_pct': round(stats.get('short_sleep', 0) / total_recs * 100, 1),
            'long_sleepers_pct': round(stats.get('long_sleep', 0) / total_recs * 100, 1),
            'source_distribution': sources,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in sleep tracker stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_smoking_tracker_stats():
    """GET /admin/trackers/smoking/stats — Aggregated smoking tracking stats."""
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})
        baselines = db.smoking_baselines.count_documents({})

        # Status distribution
        status_pipeline = [
            {"$group": {"_id": "$smoking_status", "count": {"$sum": 1}}}
        ]
        status_agg = list(db.smoking_baselines.aggregate(status_pipeline))
        statuses = {item['_id']: item['count'] for item in status_agg if item['_id']}

        # Current smokers avg cigarettes (field is typical_cigarettes_per_day, not cigarettes_per_day)
        current_pipeline = [
            {"$match": {"smoking_status": "current"}},
            {"$group": {
                "_id": None,
                "avg_cigarettes": {"$avg": "$typical_cigarettes_per_day"},
                "avg_years_smoked": {"$avg": "$years_smoked"},
                "count": {"$sum": 1}
            }}
        ]
        current_agg = list(db.smoking_baselines.aggregate(current_pipeline))
        current_stats = current_agg[0] if current_agg else {}

        # Former smokers — compute avg years since quit from quit_date in Python
        former_docs = list(db.smoking_baselines.find(
            {"smoking_status": "former", "quit_date": {"$exists": True, "$ne": None}},
            {"quit_date": 1}
        ))
        former_count = db.smoking_baselines.count_documents({"smoking_status": "former"})
        years_list = []
        for doc in former_docs:
            try:
                quit_dt = datetime.strptime(doc['quit_date'], '%Y-%m-%d')
                years_list.append((datetime.utcnow() - quit_dt).days / 365.25)
            except Exception:
                pass
        avg_years_quit = round(sum(years_list) / len(years_list), 1) if years_list else 0

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'status_distribution': statuses,
            'current_smokers': {
                'count': current_stats.get('count', 0),
                'avg_cigarettes_per_day': round(current_stats.get('avg_cigarettes') or 0, 1),
                'avg_years_smoked': round(current_stats.get('avg_years_smoked') or 0, 1),
            },
            'former_smokers': {
                'count': former_count,
                'avg_years_since_quit': avg_years_quit,
            },
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in smoking tracker stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_alcohol_tracker_stats():
    """GET /admin/trackers/alcohol/stats — Aggregated alcohol tracking stats."""
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})
        baselines = db.alcohol_baselines.count_documents({})

        # Average drinks per week (computed from baseline_drinks_per_occasion * baseline_drinking_days_per_week)
        drinks_pipeline = [
            {"$group": {
                "_id": None,
                "avg_drinks_per_week": {"$avg": {"$multiply": ["$baseline_drinks_per_occasion", "$baseline_drinking_days_per_week"]}},
                "avg_binge_freq": {"$avg": "$baseline_binge_frequency_per_month"},
                "count": {"$sum": 1}
            }}
        ]
        drinks_agg = list(db.alcohol_baselines.aggregate(drinks_pipeline))
        drinks_stats = drinks_agg[0] if drinks_agg else {}

        # Drinking pattern distribution (field is drinking_pattern)
        pattern_pipeline = [
            {"$match": {"drinking_pattern": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$drinking_pattern", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        pattern_agg = list(db.alcohol_baselines.aggregate(pattern_pipeline))
        drink_patterns = {item['_id']: item['count'] for item in pattern_agg if item['_id']}

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'avg_drinks_per_week': round(drinks_stats.get('avg_drinks_per_week') or 0, 1),
            'avg_binge_frequency_per_month': round(drinks_stats.get('avg_binge_freq') or 0, 2),
            'drinking_pattern_distribution': drink_patterns,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in alcohol tracker stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 6 — NUTRITION & MEALS (EXTENDED)
# ═══════════════════════════════════════════════════════════════════════════

def get_meals_stats():
    """GET /admin/meals/stats — Total meals, avg nutrients, unique users, this week."""
    try:
        db = get_db()
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        total_meals = db.user_meals.count_documents({})
        todays_meals = db.user_meals.count_documents({"meal_datetime": {"$gte": today_start}})
        this_week = db.user_meals.count_documents({"meal_datetime": {"$gte": week_start}})
        unique_users = len(db.user_meals.distinct("user_id"))

        # Avg nutrients across all meals
        avg_pipeline = [
            {"$group": {
                "_id": None,
                "avg_calories": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Calories", None]}}},
                "avg_protein":  {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Protein (g)", None]}}},
                "avg_carbs":    {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Carbs (g)", None]}}},
                "avg_fat":      {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Fat (g)", None]}}},
            }}
        ]
        avg_agg = list(db.user_meals.aggregate(avg_pipeline))
        avg_data = avg_agg[0] if avg_agg else {}

        # Food type distribution
        type_pipeline = [
            {"$group": {"_id": "$food_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        type_agg = list(db.user_meals.aggregate(type_pipeline))
        food_types = {item['_id']: item['count'] for item in type_agg if item['_id']}

        # Source distribution (analysis method)
        source_pipeline = [
            {"$group": {"_id": "$analysis_source", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        source_agg = list(db.user_meals.aggregate(source_pipeline))
        sources = {item['_id']: item['count'] for item in source_agg if item['_id']}

        return jsonify({
            'total_meals': total_meals,
            'todays_meals': todays_meals,
            'this_week': this_week,
            'unique_users': unique_users,
            'avg_calories': round(avg_data.get('avg_calories') or 0, 1),
            'avg_protein':  round(avg_data.get('avg_protein') or 0, 1),
            'avg_carbs':    round(avg_data.get('avg_carbs') or 0, 1),
            'avg_fat':      round(avg_data.get('avg_fat') or 0, 1),
            'food_type_distribution': food_types,
            'source_distribution': sources,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in meals stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_meals_nutrient_trends():
    """GET /admin/meals/nutrient-trends — Daily average nutrients over time."""
    try:
        db = get_db()
        days = request.args.get('days', 30, type=int)
        start, end = _parse_date_range(days)

        pipeline = [
            {"$match": {"meal_datetime": {"$gte": start, "$lte": end}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$meal_datetime"}},
                "calories": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Calories", 0]}}},
                "protein":  {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Protein (g)", 0]}}},
                "carbs":    {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Carbs (g)", 0]}}},
                "fat":      {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Fat (g)", 0]}}},
                "meal_count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        agg = list(db.user_meals.aggregate(pipeline))

        data_points = [{
            'date': item['_id'],
            'calories': round(item['calories'], 1),
            'protein':  round(item['protein'], 1),
            'carbs':    round(item['carbs'], 1),
            'fat':      round(item['fat'], 1),
            'meal_count': item['meal_count']
        } for item in agg]

        return jsonify({'data_points': data_points})
    except Exception as e:
        logging.error(f"[ADMIN] Error in nutrient trends: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def browse_meals():
    """GET /admin/meals/browse — Paginated all-meals browser with filters."""
    try:
        db = get_db()
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = request.args.get('skip', (page - 1) * limit, type=int)
        search = request.args.get('search', '').strip()
        food_type = request.args.get('food_type')

        query = {}
        if search:
            query["meal_name"] = {"$regex": search, "$options": "i"}
        if food_type:
            query["food_type"] = food_type

        meals = list(db.user_meals.find(query).sort("meal_datetime", -1).skip(skip).limit(limit))
        total = db.user_meals.count_documents(query)

        results = []
        # Cache user lookups
        user_cache = {}
        for m in meals:
            user_id = m.get('user_id')
            if user_id and user_id not in user_cache:
                try:
                    u = db.users.find_one({"_id": ObjectId(user_id) if isinstance(user_id, str) else user_id})
                    user_cache[user_id] = u
                except Exception:
                    user_cache[user_id] = None

            user = user_cache.get(user_id)
            nutrients = m.get('nutrients', {})

            results.append({
                'id': _safe_str(m['_id']),
                'user_name': _user_display(user) if user else 'Unknown',
                'meal_name': m.get('meal_name'),
                'food_name': m.get('meal_name'),
                'food_type': m.get('food_type'),
                'meal_type': m.get('food_type'),
                'calories': nutrients.get('Calories'),
                'carbs': nutrients.get('Carbs (g)'),
                'protein': nutrients.get('Protein (g)'),
                'fat': nutrients.get('Fat (g)'),
                'fiber': nutrients.get('Dietary Fiber (g)'),
                'added_sugars': nutrients.get('Added Sugars (g)'),
                'confidence': m.get('confidence_rate'),
                'source': m.get('analysis_source'),
                'image_url': m.get('image_url'),
                'date': m.get('meal_datetime').isoformat() if m.get('meal_datetime') else None,
            })

        return jsonify({'meals': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error browsing meals: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 7 — CONSULTATIONS & TELEHEALTH
# ═══════════════════════════════════════════════════════════════════════════

def get_consultations_list():
    """GET /admin/consultations — Paginated consultation list with filters."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
        status_filter = request.args.get('status')

        query = {}
        if status_filter:
            query['status'] = status_filter

        consults = list(db.consultations.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.consultations.count_documents(query)

        results = []
        for c in consults:
            patient = db.users.find_one({"_id": c.get('patient_id')}) if c.get('patient_id') else None
            physician = db.users.find_one({"_id": c.get('physician_id')}) if c.get('physician_id') else None

            results.append({
                'id': _safe_str(c['_id']),
                'patient_name': _user_display(patient) if patient else 'Unknown',
                'physician_name': _user_display(physician) if physician else 'Unknown',
                'status': c.get('status'),
                'mode': c.get('mode'),
                'rating': c.get('rating'),
                'meeting_link': c.get('meeting_link'),
                'date': c.get('created_at').isoformat() if c.get('created_at') else None,
            })

        return jsonify({'consultations': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error listing consultations: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_consultation_detail(consultation_id):
    """GET /admin/consultations/<id> — Full detail with SOAP + prescriptions."""
    try:
        db = get_db()
        consult = db.consultations.find_one({"_id": ObjectId(consultation_id)})
        if not consult:
            return jsonify(error='Consultation not found'), 404

        patient = db.users.find_one({"_id": consult.get('patient_id')}) if consult.get('patient_id') else None
        physician = db.users.find_one({"_id": consult.get('physician_id')}) if consult.get('physician_id') else None

        # SOAP notes
        soap = db.soap_notes.find_one({"consultation_id": ObjectId(consultation_id)}) or \
               db.soap_notes.find_one({"consultation_id": consultation_id})

        # Prescriptions
        prescriptions = list(db.prescriptions.find({
            "$or": [
                {"consultation_id": ObjectId(consultation_id)},
                {"consultation_id": consultation_id}
            ]
        }))

        rx_list = [{
            'id': _safe_str(rx['_id']),
            'medication': rx.get('medication'),
            'dosage': rx.get('dosage'),
            'frequency': rx.get('frequency'),
            'duration': rx.get('duration'),
            'status': rx.get('status'),
            'refills_used': rx.get('refills_used', 0),
            'refills_allowed': rx.get('refills_allowed', 0),
        } for rx in prescriptions]

        return jsonify({
            'id': _safe_str(consult['_id']),
            'patient_name': _user_display(patient) if patient else 'Unknown',
            'physician_name': _user_display(physician) if physician else 'Unknown',
            'status': consult.get('status'),
            'mode': consult.get('mode'),
            'rating': consult.get('rating'),
            'diagnosis': consult.get('diagnosis'),
            'treatment_plan': consult.get('treatment_plan'),
            'meeting_link': consult.get('meeting_link'),
            'meeting_password': consult.get('meeting_password'),
            'soap_note': {
                'subjective': soap.get('subjective') if soap else None,
                'objective': soap.get('objective') if soap else None,
                'assessment': soap.get('assessment') if soap else None,
                'plan': soap.get('plan') if soap else None,
                'vitals': soap.get('vitals') if soap else None,
            } if soap else None,
            'prescriptions': rx_list,
            'date': consult.get('created_at').isoformat() if consult.get('created_at') else None,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in consultation detail: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_appointments_list():
    """GET /admin/appointments — All appointments with filters."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
        status_filter = request.args.get('status')

        query = {}
        if status_filter:
            query['status'] = status_filter

        appointments = list(db.appointments.find(query).sort("date", -1).skip(skip).limit(limit))
        total = db.appointments.count_documents(query)

        results = []
        for a in appointments:
            patient = db.users.find_one({"_id": a.get('patient_id')}) if a.get('patient_id') else None
            physician = db.users.find_one({"_id": a.get('physician_id')}) if a.get('physician_id') else None

            results.append({
                'id': _safe_str(a['_id']),
                'patient_name': _user_display(patient) if patient else 'Unknown',
                'physician_name': _user_display(physician) if physician else 'Unknown',
                'date': a.get('date'),
                'time': a.get('time'),
                'status': a.get('status'),
                'reason': a.get('reason'),
                'created_at': a.get('created_at').isoformat() if a.get('created_at') else None,
            })

        return jsonify({'appointments': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error listing appointments: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_prescriptions_list():
    """GET /admin/prescriptions — All prescriptions with filters."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
        status_filter = request.args.get('status')

        query = {}
        if status_filter:
            query['status'] = status_filter

        prescriptions = list(db.prescriptions.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.prescriptions.count_documents(query)

        results = []
        for rx in prescriptions:
            patient = db.users.find_one({"_id": rx.get('patient_id')}) if rx.get('patient_id') else None
            physician = db.users.find_one({"_id": rx.get('physician_id')}) if rx.get('physician_id') else None

            results.append({
                'id': _safe_str(rx['_id']),
                'patient_name': _user_display(patient) if patient else 'Unknown',
                'physician_name': _user_display(physician) if physician else 'Unknown',
                'medication': rx.get('medication'),
                'dosage': rx.get('dosage'),
                'frequency': rx.get('frequency'),
                'duration': rx.get('duration'),
                'status': rx.get('status'),
                'refills_used': rx.get('refills_used', 0),
                'refills_allowed': rx.get('refills_allowed', 0),
                'date': rx.get('created_at').isoformat() if rx.get('created_at') else None,
            })

        return jsonify({'prescriptions': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error listing prescriptions: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 8 — CHAT & COMMUNICATION
# ═══════════════════════════════════════════════════════════════════════════

def get_chat_stats():
    """GET /admin/chat/stats — Conversation and message counts."""
    try:
        db = get_db()
        total_conversations = db.conversations.count_documents({})
        total_messages = db.messages.count_documents({})

        # Active conversations (messages in last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_msg_conv_ids = db.messages.distinct("conversation_id", {
            "created_at": {"$gte": seven_days_ago}
        })
        active_conversations = len(recent_msg_conv_ids)

        # Messages per day (last 30 days)
        msg_pipeline = [
            {"$match": {"created_at": {"$gte": datetime.utcnow() - timedelta(days=30)}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        msg_daily = list(db.messages.aggregate(msg_pipeline))
        daily_messages = [{"date": item['_id'], "count": item['count']} for item in msg_daily]

        return jsonify({
            'total_conversations': total_conversations,
            'active_conversations': active_conversations,
            'total_messages': total_messages,
            'daily_messages': daily_messages,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in chat stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_chat_conversations():
    """GET /admin/chat/conversations — Paginated conversation list."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)

        conversations = list(db.conversations.find().sort("updated_at", -1).skip(skip).limit(limit))
        total = db.conversations.count_documents({})

        results = []
        for conv in conversations:
            participants = conv.get('participants', [])
            participant_names = []
            for pid in participants:
                try:
                    u = db.users.find_one({"_id": ObjectId(pid)})
                    if not u:
                        u = db.users.find_one({"uid": pid})
                    participant_names.append(_user_display(u) if u else 'Unknown')
                except Exception:
                    participant_names.append('Unknown')

            # Get latest message
            latest_msg = db.messages.find_one(
                {"conversation_id": conv['_id']},
                sort=[("created_at", -1)]
            )

            # Count messages
            msg_count = db.messages.count_documents({"conversation_id": conv['_id']})

            results.append({
                'id': _safe_str(conv['_id']),
                'participants': participant_names,
                'last_message': latest_msg.get('text', '')[:100] if latest_msg else None,
                'last_activity': latest_msg.get('created_at').isoformat() if latest_msg and latest_msg.get('created_at') else None,
                'message_count': msg_count,
            })

        return jsonify({'conversations': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error listing conversations: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_conversation_messages(conversation_id):
    """GET /admin/chat/conversations/<id>/messages — Read-only message history."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 50, type=int)

        messages = list(db.messages.find(
            {"conversation_id": ObjectId(conversation_id)}
        ).sort("created_at", 1).skip(skip).limit(limit))

        total = db.messages.count_documents({"conversation_id": ObjectId(conversation_id)})

        results = []
        sender_cache = {}
        for msg in messages:
            sender_id = msg.get('sender_id')
            if sender_id and sender_id not in sender_cache:
                try:
                    u = db.users.find_one({"_id": ObjectId(sender_id)})
                    sender_cache[sender_id] = u
                except Exception:
                    sender_cache[sender_id] = None

            sender = sender_cache.get(sender_id)
            results.append({
                'id': _safe_str(msg['_id']),
                'sender_name': _user_display(sender) if sender else 'Unknown',
                'text': msg.get('text'),
                'image_url': msg.get('image_url'),
                'read': msg.get('read', False),
                'timestamp': msg.get('created_at').isoformat() if msg.get('created_at') else None,
            })

        return jsonify({'messages': results, 'total': total})
    except Exception as e:
        logging.error(f"[ADMIN] Error reading messages: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 9 — AI & CHATBOT
# ═══════════════════════════════════════════════════════════════════════════

def get_chatbot_stats():
    """GET /admin/chatbot/stats — Usage stats."""
    try:
        db = get_db()
        total_messages = db.chatbot_messages.count_documents({})
        unique_users = len(db.chatbot_messages.distinct("user_id"))
        # Each unique user represents one conversation thread
        total_conversations = unique_users

        # Today's users
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        active_today = len(db.chatbot_messages.distinct("user_id", {
            "created_at": {"$gte": today_start}
        }))

        avg_per_session = round(total_messages / unique_users, 1) if unique_users > 0 else 0

        # Daily usage (last 30 days)
        daily_pipeline = [
            {"$match": {"created_at": {"$gte": datetime.utcnow() - timedelta(days=30)}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        daily_agg = list(db.chatbot_messages.aggregate(daily_pipeline))
        daily_usage = [{"date": item['_id'], "count": item['count']} for item in daily_agg]

        # Peak hours
        hour_pipeline = [
            {"$match": {"created_at": {"$gte": datetime.utcnow() - timedelta(days=30)}}},
            {"$group": {
                "_id": {"$hour": "$created_at"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        hour_agg = list(db.chatbot_messages.aggregate(hour_pipeline))
        peak_hours = [{"hour": item['_id'], "count": item['count']} for item in hour_agg]

        return jsonify({
            'total_conversations': total_conversations,
            'total_messages': total_messages,
            'unique_users': unique_users,
            'active_today': active_today,
            'avg_messages_per_session': avg_per_session,
            'daily_usage': daily_usage,
            'peak_hours': peak_hours,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in chatbot stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_chatbot_conversations():
    """GET /admin/chatbot/conversations — Recent conversations grouped by user."""
    try:
        db = get_db()
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = request.args.get('skip', (page - 1) * limit, type=int)

        # Group by user
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$user_id",
                "total_messages": {"$sum": 1},
                "last_message": {"$first": "$user_message"},
                "last_response": {"$first": "$bot_response"},
                "last_interaction": {"$first": "$created_at"}
            }},
            {"$sort": {"last_interaction": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        grouped = list(db.chatbot_messages.aggregate(pipeline))

        results = []
        for g in grouped:
            user = None
            if g['_id']:
                try:
                    user = db.users.find_one({"_id": ObjectId(g['_id'])})
                except Exception:
                    pass

            results.append({
                'user_id': _safe_str(g['_id']),
                'user_name': _user_display(user) if user else 'Unknown',
                'message_count': g['total_messages'],
                'total_messages': g['total_messages'],
                'last_message': g.get('last_message', '')[:100],
                'last_response': g.get('last_response', '')[:100],
                'last_message_at': g['last_interaction'].isoformat() if g.get('last_interaction') else None,
                'last_interaction': g['last_interaction'].isoformat() if g.get('last_interaction') else None,
            })

        total_users = len(db.chatbot_messages.distinct("user_id"))
        return jsonify({'conversations': results, 'total': total_users})
    except Exception as e:
        logging.error(f"[ADMIN] Error in chatbot conversations: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_ai_food_analysis_stats():
    """GET /admin/ai/food-analysis-stats — Gemini analysis counts + confidence."""
    try:
        db = get_db()

        # Count by image vs text
        image_analyses = db.user_meals.count_documents({"image_url": {"$exists": True, "$ne": None}})
        text_analyses = db.user_meals.count_documents({"image_url": {"$in": [None, ""]}})
        total_analyses = image_analyses + text_analyses

        # This week
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today - timedelta(days=today.weekday())
        this_week = db.user_meals.count_documents({"meal_datetime": {"$gte": week_start}})

        # Unique users
        unique_users = len(db.user_meals.distinct("user_id"))

        # Average confidence — confidence_rate is stored as 0-100
        conf_pipeline = [
            {"$match": {"confidence_rate": {"$exists": True, "$ne": None}}},
            {"$group": {
                "_id": None,
                "avg_confidence": {"$avg": "$confidence_rate"},
                "count": {"$sum": 1},
                "low_confidence": {"$sum": {"$cond": [{"$lt": ["$confidence_rate", 50]}, 1, 0]}}
            }}
        ]
        conf_agg = list(db.user_meals.aggregate(conf_pipeline))
        conf_stats = conf_agg[0] if conf_agg else {}
        avg_conf_raw = conf_stats.get('avg_confidence', 0) or 0
        # Normalise: if stored as 0-100 keep as-is, convert to 0-1 fraction for the frontend
        avg_confidence_pct = round(avg_conf_raw if avg_conf_raw <= 1 else avg_conf_raw / 100, 4)

        # Top analyzed foods
        top_foods_pipeline = [
            {"$match": {"meal_name": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$meal_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 8}
        ]
        top_foods_agg = list(db.user_meals.aggregate(top_foods_pipeline))
        top_foods = [{"name": item['_id'], "count": item['count']} for item in top_foods_agg]

        return jsonify({
            'image_analyses': image_analyses,
            'text_analyses': text_analyses,
            'total_analyses': total_analyses,
            'this_week': this_week,
            'unique_users': unique_users,
            'avg_confidence': avg_confidence_pct,
            'low_confidence_count': conf_stats.get('low_confidence', 0),
            'top_foods': top_foods,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in AI food analysis stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 10 — SYSTEM & SERVICES
# ═══════════════════════════════════════════════════════════════════════════

def get_system_health():
    """GET /admin/system/health — Extended health with all service statuses."""
    try:
        services = {}

        # MongoDB
        try:
            db = get_db()
            db.command('ping')
            services['mongodb'] = {'status': 'connected', 'type': 'database'}
        except Exception as e:
            services['mongodb'] = {'status': 'error', 'error': str(e), 'type': 'database'}

        # Firebase
        try:
            from firebase_admin import auth
            # Simple check
            services['firebase'] = {'status': 'ready', 'type': 'auth'}
        except Exception as e:
            services['firebase'] = {'status': 'error', 'error': str(e), 'type': 'auth'}

        # Gemini AI
        try:
            from services.gemini_service import get_gemini_service
            gemini = get_gemini_service()
            if gemini and gemini.is_ready():
                services['gemini_ai'] = {'status': 'ready', 'type': 'ai'}
            else:
                services['gemini_ai'] = {'status': 'not_ready', 'type': 'ai'}
        except Exception:
            services['gemini_ai'] = {'status': 'unavailable', 'type': 'ai'}

        # Groq LLM
        try:
            from services.groq_service import get_groq_service
            groq = get_groq_service()
            if groq:
                services['groq_llm'] = {'status': 'ready', 'type': 'ai'}
            else:
                services['groq_llm'] = {'status': 'not_ready', 'type': 'ai'}
        except Exception:
            services['groq_llm'] = {'status': 'unavailable', 'type': 'ai'}

        # ML Model
        try:
            from services.ml_service import ml_service, ml_service_initialized, ml_service_initializing
            if ml_service_initializing:
                services['ml_nutrient_predictor'] = {'status': 'initializing', 'type': 'ml'}
            elif ml_service_initialized and ml_service and ml_service.is_model_ready():
                services['ml_nutrient_predictor'] = {'status': 'ready', 'type': 'ml'}
            elif ml_service_initialized:
                services['ml_nutrient_predictor'] = {'status': 'error', 'type': 'ml'}
            else:
                services['ml_nutrient_predictor'] = {'status': 'lazy_load_pending', 'type': 'ml'}
        except Exception:
            services['ml_nutrient_predictor'] = {'status': 'unavailable', 'type': 'ml'}

        # Diabetes Model
        try:
            from services.diabetes_service import get_diabetes_service
            ds = get_diabetes_service()
            if ds:
                services['diabetes_ml_model'] = {'status': 'ready', 'type': 'ml'}
            else:
                services['diabetes_ml_model'] = {'status': 'not_ready', 'type': 'ml'}
        except Exception:
            services['diabetes_ml_model'] = {'status': 'unavailable', 'type': 'ml'}

        # Cloudinary
        try:
            import cloudinary
            if cloudinary.config().cloud_name:
                services['cloudinary'] = {'status': 'configured', 'type': 'storage'}
            else:
                services['cloudinary'] = {'status': 'not_configured', 'type': 'storage'}
        except Exception:
            services['cloudinary'] = {'status': 'unavailable', 'type': 'storage'}

        # Email
        try:
            import os
            if os.getenv('MAIL_USERNAME'):
                services['email_smtp'] = {'status': 'configured', 'type': 'email'}
            else:
                services['email_smtp'] = {'status': 'not_configured', 'type': 'email'}
        except Exception:
            services['email_smtp'] = {'status': 'unavailable', 'type': 'email'}

        return jsonify({
            'status': 'healthy',
            'services': services,
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in system health: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_database_stats():
    """GET /admin/system/database-stats — Collection document counts."""
    try:
        db = get_db()
        collections = [
            'users', 'physicians', 'user_meals', 'health_data',
            'diabetes_assessments', 'overall_risk_assessments',
            'food_baseline_assessments',
            'sleep_baselines', 'sleep_daily_records',
            'step_baselines', 'step_daily_records',
            'smoking_baselines', 'smoking_daily_records',
            'alcohol_baselines', 'alcohol_daily_records',
            'conversations', 'messages', 'chatbot_messages',
            'consultations', 'appointments', 'prescriptions',
            'soap_notes', 'patient_physician', 'physician_availability',
            'user_activities',
        ]

        stats = {}
        total_documents = 0
        for coll in collections:
            try:
                count = db[coll].count_documents({})
                stats[coll] = count
                total_documents += count
            except Exception:
                stats[coll] = 0

        return jsonify({
            'collections': stats,
            'total_documents': total_documents,
            'total_collections': len(stats)
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in database stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_platform_config():
    """GET /admin/system/config — Platform configuration values."""
    try:
        import os
        return jsonify({
            'jwt_expiration': '7 days',
            'max_upload_size': '10 MB',
            'step_goal': 10000,
            'risk_weights': {
                'initial_assessment': 0.35,
                'food': 0.15,
                'smoking': 0.13,
                'sleep': 0.12,
                'steps': 0.10,
                'alcohol': 0.08,
                'bmi': 0.05,
                'age': 0.02,
                'sex': 0.01,
            },
            'confidence_thresholds': {
                'preliminary': '<7 days',
                'moderate': '7-14 days',
                'good': '14-30 days',
                'high': '30+ days',
            },
            'binge_thresholds': {
                'female': 4,
                'male': 5,
            },
            'sleep_optimal_range': '7-8 hours',
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in platform config: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_system_logs():
    """GET /admin/system/logs — Recent error logs."""
    try:
        limit = request.args.get('limit', 50, type=int)
        log_file = 'logs/app.log'

        logs = []
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                # Get last N error lines
                error_lines = [l.strip() for l in lines if 'ERROR' in l or 'WARNING' in l]
                logs = error_lines[-limit:]
        except FileNotFoundError:
            logs = ['Log file not found']
        except Exception as e:
            logs = [f'Error reading logs: {str(e)}']

        return jsonify({'logs': logs, 'count': len(logs)})
    except Exception as e:
        logging.error(f"[ADMIN] Error reading system logs: {e}", exc_info=True)
        return jsonify(error=str(e)), 500
