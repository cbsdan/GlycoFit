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
    """GET /admin/risk/distribution — Count of users per overall risk category."""
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
        distribution = {item['_id']: item['count'] for item in agg if item['_id']}

        total_assessed = sum(distribution.values())
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})

        return jsonify({
            'distribution': distribution,
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
        trackers = {}

        # Food baseline
        food_bl = db.food_baseline_assessments.find_one({"user_id": user_id_str})
        trackers['food'] = {
            'has_baseline': food_bl is not None,
            'baseline_risk_score': food_bl.get('risk_score') if food_bl else None,
            'baseline_risk_level': food_bl.get('risk_level') if food_bl else None,
        }

        # Step baseline & recent
        step_bl = db.step_baselines.find_one({"user_id": user_id_str})
        recent_steps = list(db.step_daily_records.find(
            {"user_id": user_id_str}
        ).sort("date", -1).limit(7))
        avg_steps_7d = sum(r.get('total_steps', 0) for r in recent_steps) / max(len(recent_steps), 1)
        trackers['steps'] = {
            'has_baseline': step_bl is not None,
            'avg_daily_steps_7d': round(avg_steps_7d),
            'activity_level': step_bl.get('activity_level') if step_bl else None,
            'recent_records': len(recent_steps),
        }

        # Sleep baseline & recent
        sleep_bl = db.sleep_baselines.find_one({"user_id": user_id_str})
        recent_sleep = list(db.sleep_daily_records.find(
            {"user_id": user_id_str}
        ).sort("date", -1).limit(7))
        avg_sleep_7d = sum(r.get('sleep_duration_hours', 0) for r in recent_sleep) / max(len(recent_sleep), 1)
        trackers['sleep'] = {
            'has_baseline': sleep_bl is not None,
            'avg_sleep_hours_7d': round(avg_sleep_7d, 1),
            'baseline_avg': sleep_bl.get('baseline_avg_sleep_hours') if sleep_bl else None,
            'recent_records': len(recent_sleep),
        }

        # Smoking baseline
        smoking_bl = db.smoking_baselines.find_one({"user_id": user_id_str})
        trackers['smoking'] = {
            'has_baseline': smoking_bl is not None,
            'status': smoking_bl.get('smoking_status') if smoking_bl else None,
            'cigarettes_per_day': smoking_bl.get('cigarettes_per_day') if smoking_bl else None,
            'pack_years': smoking_bl.get('pack_years') if smoking_bl else None,
        }

        # Alcohol baseline
        alcohol_bl = db.alcohol_baselines.find_one({"user_id": user_id_str})
        trackers['alcohol'] = {
            'has_baseline': alcohol_bl is not None,
            'drinks_per_week': alcohol_bl.get('drinks_per_week') if alcohol_bl else None,
            'binge_frequency': alcohol_bl.get('binge_frequency') if alcohol_bl else None,
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

        user_id_str = str(user._id)

        assessment = db.diabetes_assessments.find_one(
            {"user_id": user_id_str},
            sort=[("created_at", -1)]
        )

        if not assessment:
            return jsonify({'has_assessment': False})

        return jsonify({
            'has_assessment': True,
            'answers': assessment.get('answers', {}),
            'prediction': assessment.get('prediction', {}),
            'risk_level': assessment.get('risk_level'),
            'probability': assessment.get('probability'),
            'confidence': assessment.get('confidence'),
            'assessed_at': assessment.get('created_at').isoformat() if assessment.get('created_at') else None
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

        user_id_str = str(user._id)
        start, end = _parse_date_range(30)

        # Activity records
        activities = list(db.user_activities.find({
            "user_id": user_id_str,
            "date": {"$gte": start.strftime('%Y-%m-%d'), "$lte": end.strftime('%Y-%m-%d')}
        }).sort("date", -1).limit(30))

        activity_data = [{
            'date': a.get('date'),
            'steps': a.get('steps'),
            'distance': a.get('distance'),
            'calories_burned': a.get('calories_burned'),
            'active_minutes': a.get('active_minutes'),
        } for a in activities]

        # Health data (Health Connect synced data)
        health_records = list(db.health_data.find({
            "user_id": user_id_str,
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

            # Get physician profile
            physician_profile = db.physicians.find_one({"user_id": user_id_str}) or \
                                db.physicians.find_one({"uid": uid}) or {}

            # Count patients
            patient_count = db.patient_physician.count_documents({
                "$or": [
                    {"physician_id": user_id_str},
                    {"physician_id": uid}
                ],
                "status": "accepted"
            })

            # Count consultations
            consult_count = db.consultations.count_documents({
                "$or": [
                    {"physician_id": u['_id']},
                    {"physician_id": user_id_str}
                ]
            })

            from models.user import User
            user_obj = User.from_dict(u)
            user_obj._id = u['_id']

            physicians.append({
                **user_obj.to_safe_dict(),
                'specialization': physician_profile.get('specialization'),
                'license_number': physician_profile.get('license_number'),
                'clinic_name': physician_profile.get('clinic_name'),
                'consultation_fee': physician_profile.get('consultation_fee'),
                'experience_years': physician_profile.get('experience_years'),
                'languages': physician_profile.get('languages', []),
                'bio': physician_profile.get('bio'),
                'total_patients': patient_count,
                'total_consultations': consult_count,
                'is_available': physician_profile.get('is_available', False),
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

        # Professional profile
        profile = db.physicians.find_one({"user_id": user_id_str}) or \
                  db.physicians.find_one({"uid": user.uid}) or {}

        # Consultation stats
        consult_pipeline = [
            {"$match": {"$or": [
                {"physician_id": user._id},
                {"physician_id": user_id_str}
            ]}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        consult_agg = list(db.consultations.aggregate(consult_pipeline))
        consult_by_status = {item['_id']: item['count'] for item in consult_agg if item['_id']}

        # Average rating
        rating_pipeline = [
            {"$match": {
                "$or": [{"physician_id": user._id}, {"physician_id": user_id_str}],
                "rating": {"$exists": True, "$ne": None}
            }},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]
        rating_agg = list(db.consultations.aggregate(rating_pipeline))

        # Patient count
        patient_count = db.patient_physician.count_documents({
            "$or": [{"physician_id": user_id_str}, {"physician_id": user.uid}],
            "status": "accepted"
        })

        # Prescriptions count
        rx_count = db.prescriptions.count_documents({
            "$or": [{"physician_id": user._id}, {"physician_id": user_id_str}]
        })

        return jsonify({
            'user': user.to_safe_dict(),
            'profile': {
                'specialization': profile.get('specialization'),
                'license_number': profile.get('license_number'),
                'clinic_name': profile.get('clinic_name'),
                'consultation_fee': profile.get('consultation_fee'),
                'experience_years': profile.get('experience_years'),
                'languages': profile.get('languages', []),
                'bio': profile.get('bio'),
                'is_available': profile.get('is_available', False),
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

        user_id_str = str(user._id)

        connections = list(db.patient_physician.find({
            "$or": [
                {"physician_id": user_id_str},
                {"physician_id": user.uid}
            ]
        }).sort("created_at", -1))

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

        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
        status_filter = request.args.get('status')

        query = {"$or": [
            {"physician_id": user._id},
            {"physician_id": str(user._id)}
        ]}
        if status_filter:
            query['status'] = status_filter

        consults = list(db.consultations.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.consultations.count_documents(query)

        results = []
        for c in consults:
            patient = db.users.find_one({"_id": c.get('patient_id')}) if c.get('patient_id') else None
            results.append({
                'id': _safe_str(c['_id']),
                'patient_name': _user_display(patient) if patient else 'Unknown',
                'status': c.get('status'),
                'mode': c.get('mode'),
                'rating': c.get('rating'),
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

        user_id_str = str(user._id)

        availability = list(db.physician_availability.find({
            "$or": [
                {"physician_id": user_id_str},
                {"physician_id": user.uid}
            ]
        }))

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
        component_sums = {}
        component_counts = {}
        for assessment in latest_assessments:
            components = assessment.get('component_scores', {})
            for key, val in components.items():
                if isinstance(val, (int, float)):
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
    """GET /admin/risk/high-risk-patients — Paginated high/very_high risk users."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)

        # Get latest assessment per user, filtered to high/very_high
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
                conn = db.patient_physician.find_one({
                    "patient_id": str(user['_id']),
                    "status": "accepted"
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
    """GET /admin/assessments/stats — Diabetes assessment completion stats."""
    try:
        db = get_db()
        total_users = db.users.count_documents({"role": {"$in": ["user", "admin"]}})

        # Unique users with assessments
        unique_assessed = len(db.diabetes_assessments.distinct("user_id"))

        # Risk level distribution
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$user_id", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$group": {"_id": "$risk_level", "count": {"$sum": 1}}}
        ]
        agg = list(db.diabetes_assessments.aggregate(pipeline))
        risk_distribution = {item['_id']: item['count'] for item in agg if item['_id']}

        # Average probability
        prob_pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$user_id", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$match": {"probability": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": None, "avg_prob": {"$avg": "$probability"}}}
        ]
        prob_result = list(db.diabetes_assessments.aggregate(prob_pipeline))
        avg_probability = round(prob_result[0]['avg_prob'], 2) if prob_result else 0

        return jsonify({
            'total_users': total_users,
            'assessed_users': unique_assessed,
            'completion_rate': round(unique_assessed / total_users * 100, 1) if total_users > 0 else 0,
            'risk_distribution': risk_distribution,
            'avg_probability': avg_probability
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in assessment stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def get_assessments_list():
    """GET /admin/assessments/list — All diabetes assessments with user info."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
        risk_filter = request.args.get('risk_level')

        query = {}
        if risk_filter:
            query['risk_level'] = risk_filter

        assessments = list(db.diabetes_assessments.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.diabetes_assessments.count_documents(query)

        results = []
        for a in assessments:
            user = None
            if a.get('user_id'):
                try:
                    user = db.users.find_one({"_id": ObjectId(a['user_id'])})
                except Exception:
                    pass

            results.append({
                'id': _safe_str(a['_id']),
                'user_name': _user_display(user) if user else 'Unknown',
                'user_email': user.get('email') if user else None,
                'risk_level': a.get('risk_level'),
                'probability': a.get('probability'),
                'confidence': a.get('confidence'),
                'assessed_at': a.get('created_at').isoformat() if a.get('created_at') else None
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

        # Risk distribution from baselines
        risk_pipeline = [
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

        # Average daily steps (last 30 days)
        step_pipeline = [
            {"$match": {
                "date": {"$gte": (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')}
            }},
            {"$group": {
                "_id": None,
                "avg_steps": {"$avg": "$total_steps"},
                "total_records": {"$sum": 1},
                "goal_met": {"$sum": {"$cond": [{"$gte": ["$total_steps", 10000]}, 1, 0]}}
            }}
        ]
        step_agg = list(db.step_daily_records.aggregate(step_pipeline))
        stats = step_agg[0] if step_agg else {}

        # Activity level distribution from baselines
        level_pipeline = [
            {"$group": {"_id": "$activity_level", "count": {"$sum": 1}}}
        ]
        level_agg = list(db.step_baselines.aggregate(level_pipeline))
        levels = {item['_id']: item['count'] for item in level_agg if item['_id']}

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'avg_daily_steps': round(stats.get('avg_steps', 0)),
            'total_records_30d': stats.get('total_records', 0),
            'goal_achievement_rate': round(stats.get('goal_met', 0) / stats.get('total_records', 1) * 100, 1) if stats.get('total_records') else 0,
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

        # Current smokers avg cigarettes
        current_pipeline = [
            {"$match": {"smoking_status": "current"}},
            {"$group": {
                "_id": None,
                "avg_cigarettes": {"$avg": "$cigarettes_per_day"},
                "avg_pack_years": {"$avg": "$pack_years"},
                "count": {"$sum": 1}
            }}
        ]
        current_agg = list(db.smoking_baselines.aggregate(current_pipeline))
        current_stats = current_agg[0] if current_agg else {}

        # Former smokers
        former_pipeline = [
            {"$match": {"smoking_status": "former"}},
            {"$group": {
                "_id": None,
                "avg_years_quit": {"$avg": "$years_since_quit"},
                "count": {"$sum": 1}
            }}
        ]
        former_agg = list(db.smoking_baselines.aggregate(former_pipeline))
        former_stats = former_agg[0] if former_agg else {}

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'status_distribution': statuses,
            'current_smokers': {
                'count': current_stats.get('count', 0),
                'avg_cigarettes_per_day': round(current_stats.get('avg_cigarettes', 0), 1),
                'avg_pack_years': round(current_stats.get('avg_pack_years', 0), 1),
            },
            'former_smokers': {
                'count': former_stats.get('count', 0),
                'avg_years_since_quit': round(former_stats.get('avg_years_quit', 0), 1),
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

        # Average drinks per week
        drinks_pipeline = [
            {"$group": {
                "_id": None,
                "avg_drinks": {"$avg": "$drinks_per_week"},
                "avg_binge": {"$avg": "$binge_frequency"},
                "count": {"$sum": 1}
            }}
        ]
        drinks_agg = list(db.alcohol_baselines.aggregate(drinks_pipeline))
        drinks_stats = drinks_agg[0] if drinks_agg else {}

        # Drink type preferences
        type_pipeline = [
            {"$unwind": {"path": "$preferred_drink_types", "preserveNullAndEmptyArrays": False}},
            {"$group": {"_id": "$preferred_drink_types", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        type_agg = list(db.alcohol_baselines.aggregate(type_pipeline))
        drink_types = {item['_id']: item['count'] for item in type_agg if item['_id']}

        return jsonify({
            'total_users': total_users,
            'baselines': baselines,
            'completion_rate': round(baselines / total_users * 100, 1) if total_users > 0 else 0,
            'avg_drinks_per_week': round(drinks_stats.get('avg_drinks', 0), 1),
            'avg_binge_frequency': round(drinks_stats.get('avg_binge', 0), 2),
            'drink_type_preferences': drink_types,
        })
    except Exception as e:
        logging.error(f"[ADMIN] Error in alcohol tracker stats: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


# ═══════════════════════════════════════════════════════════════════════════
# TAB 6 — NUTRITION & MEALS (EXTENDED)
# ═══════════════════════════════════════════════════════════════════════════

def get_meals_stats():
    """GET /admin/meals/stats — Total meals, today's meals, food type distribution."""
    try:
        db = get_db()
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        total_meals = db.user_meals.count_documents({})
        todays_meals = db.user_meals.count_documents({"meal_datetime": {"$gte": today_start}})

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
        start, end = _parse_date_range(30)

        pipeline = [
            {"$match": {"meal_datetime": {"$gte": start, "$lte": end}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$meal_datetime"}},
                "avg_calories": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Calories", 0]}}},
                "avg_protein": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Protein (g)", 0]}}},
                "avg_carbs": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Carbs (g)", 0]}}},
                "avg_fat": {"$avg": {"$toDouble": {"$ifNull": ["$nutrients.Fat (g)", 0]}}},
                "meal_count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        agg = list(db.user_meals.aggregate(pipeline))

        trends = [{
            'date': item['_id'],
            'avg_calories': round(item['avg_calories'], 1),
            'avg_protein': round(item['avg_protein'], 1),
            'avg_carbs': round(item['avg_carbs'], 1),
            'avg_fat': round(item['avg_fat'], 1),
            'meal_count': item['meal_count']
        } for item in agg]

        return jsonify({'trends': trends})
    except Exception as e:
        logging.error(f"[ADMIN] Error in nutrient trends: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


def browse_meals():
    """GET /admin/meals/browse — Paginated all-meals browser with filters."""
    try:
        db = get_db()
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)
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
                'food_type': m.get('food_type'),
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

        # Today's users
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        active_today = len(db.chatbot_messages.distinct("user_id", {
            "created_at": {"$gte": today_start}
        }))

        avg_per_user = round(total_messages / unique_users, 1) if unique_users > 0 else 0

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
            'total_messages': total_messages,
            'unique_users': unique_users,
            'active_today': active_today,
            'avg_messages_per_user': avg_per_user,
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
        skip = request.args.get('skip', 0, type=int)
        limit = request.args.get('limit', 20, type=int)

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
                'total_messages': g['total_messages'],
                'last_message': g.get('last_message', '')[:100],
                'last_response': g.get('last_response', '')[:100],
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

        # Average confidence
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

        return jsonify({
            'image_analyses': image_analyses,
            'text_analyses': text_analyses,
            'total_analyses': image_analyses + text_analyses,
            'avg_confidence': round(conf_stats.get('avg_confidence', 0), 1),
            'low_confidence_count': conf_stats.get('low_confidence', 0),
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
