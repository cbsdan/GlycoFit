from flask import request, jsonify, g
from models.user import User
from models.physician import Physician
from models.patient_physician import PatientPhysician
from models.health_data import HealthData
from models.prescription import Prescription
from models.consultation import Consultation
from models.diabetes_assessment import DiabetesAssessment
from models.food_baseline_assessment import FoodBaselineAssessment
from models.sleep_tracking import SleepBaseline, SleepMetrics
from models.step_tracking import StepBaseline, StepMetrics
from models.smoking_intake import SmokingIntake
from models.alcohol_intake import AlcoholBaseline, AlcoholMetrics
from services.food_tracking_service import FoodTrackingService
from services.sleep_tracking_service import SleepTrackingService
from services.smoking_tracking_service import SmokingTrackingService
from services.step_tracking_service import StepTrackingService
from config.database import get_db
from bson import ObjectId
from datetime import datetime, timedelta
import logging

def get_patient_requests():
    """Get pending patient requests for current physician"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        # Get pending requests
        requests = PatientPhysician.get_physician_patients(physician._id, status='pending')
        
        # Populate patient data
        result = []
        for req in requests:
            patient = User.find_by_id(str(req.patient_id))
            if patient:
                request_data = req.to_safe_dict()
                request_data['patient'] = patient.to_safe_dict()
                result.append(request_data)
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting patient requests: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get patient requests'
        }), 500

def accept_patient_request(request_id):
    """Accept a patient request"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        # Get the request
        patient_physician = PatientPhysician.find_by_id(request_id)
        
        if not patient_physician:
            return jsonify({
                'success': False,
                'message': 'Request not found'
            }), 404
        
        # Verify it belongs to this physician
        if str(patient_physician.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Accept the request
        notes = data.get('notes', '')
        patient_physician.accept(notes)
        patient_physician.save()
        
        # Update physician stats
        physician.total_patients += 1
        physician.save()
        
        return jsonify({
            'success': True,
            'message': 'Patient request accepted',
            'data': patient_physician.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error accepting patient request: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to accept patient request'
        }), 500

def decline_patient_request(request_id):
    """Decline a patient request"""
    try:
        current_user = g.current_user
        data = request.get_json() or {}
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            logging.info(f"Creating physician profile for user: {current_user.email}")
            physician = Physician(
                user_id=current_user._id,
                specialization='General Practice',
                license_number='',
                years_of_experience=0
            )
            physician.save()
            logging.info(f"Physician profile created successfully")
        
        # Get the request
        patient_physician = PatientPhysician.find_by_id(request_id)
        
        if not patient_physician:
            return jsonify({
                'success': False,
                'message': 'Request not found'
            }), 404
        
        # Verify it belongs to this physician
        if str(patient_physician.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Decline the request
        notes = data.get('notes', '')
        patient_physician.decline(notes)
        patient_physician.save()
        
        return jsonify({
            'success': True,
            'message': 'Patient request declined',
            'data': patient_physician.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error declining patient request: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to decline patient request'
        }), 500

def get_physician_patients():
    """Get all patients for current physician"""
    try:
        current_user = g.current_user
        status = request.args.get('status', 'active')  # active, pending, all
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        # Get patients based on status filter
        if status == 'all':
            relationships = PatientPhysician.get_physician_patients(physician._id)
        else:
            relationships = PatientPhysician.get_physician_patients(physician._id, status=status)
        
        # Populate patient data
        result = []
        for rel in relationships:
            patient = User.find_by_id(str(rel.patient_id))
            if patient:
                patient_data = patient.to_safe_dict()
                patient_data['relationship'] = rel.to_safe_dict()
                
                patient_id = str(rel.patient_id)
                
                # Fetch real health data for each patient
                health_info = {
                    'last_visit': rel.acceptance_date.isoformat() if rel.acceptance_date else None
                }
                
                # Get latest glucose reading
                try:
                    latest_glucose = HealthData.get_latest_by_type(patient_id, 'blood_glucose')
                    health_info['glucose_level'] = latest_glucose.get('value') if latest_glucose else None
                except Exception:
                    health_info['glucose_level'] = None
                
                # Get active prescription count
                try:
                    prescriptions = Prescription.get_patient_prescriptions(patient_id, status='active')
                    health_info['medications'] = len(prescriptions) if prescriptions else 0
                except Exception:
                    health_info['medications'] = 0
                
                # Get last consultation date
                try:
                    consultations = Consultation.get_patient_consultations(patient_id)
                    if consultations:
                        last_consultation = consultations[0]
                        health_info['last_visit'] = last_consultation.scheduled_date.isoformat() if hasattr(last_consultation, 'scheduled_date') and last_consultation.scheduled_date else health_info['last_visit']
                except Exception:
                    pass
                
                patient_data['health_info'] = health_info
                
                result.append(patient_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting physician patients: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get patients'
        }), 500

def get_patient_details(patient_id):
    """Get details of a specific patient with comprehensive health data"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            logging.info(f"Creating physician profile for user: {current_user.email}")
            physician = Physician(
                user_id=current_user._id,
                specialization='General Practice',
                license_number='',
                years_of_experience=0
            )
            physician.save()
            logging.info(f"Physician profile created successfully")
        
        # If caller passed a Firebase UID via query param, resolve it to Mongo _id
        firebase_uid = request.args.get('uid') or request.args.get('firebase_uid')
        if firebase_uid:
            try:
                user_by_uid = User.find_by_uid(firebase_uid)
                if not user_by_uid:
                    return jsonify({
                        'success': False,
                        'message': 'Patient not found by uid'
                    }), 404
                # replace patient_id with resolved Mongo id for subsequent lookups
                patient_id = str(user_by_uid._id)
            except Exception as uid_err:
                logging.warning(f"Error resolving uid {firebase_uid}: {str(uid_err)}")

        # Verify relationship exists - prefer active over other statuses
        # (there may be multiple records, e.g. one active + one inactive)
        relationship = PatientPhysician.find_by_patient_and_physician(patient_id, physician._id, status='active')
        if not relationship:
            relationship = PatientPhysician.find_by_patient_and_physician(patient_id, physician._id, status='pending')
        if not relationship:
            relationship = PatientPhysician.find_by_patient_and_physician(patient_id, physician._id)
        
        if not relationship:
            return jsonify({
                'success': False,
                'message': 'Patient not found or not associated with this physician'
            }), 404
        
        if relationship.status in ['declined']:
            return jsonify({
                'success': False,
                'message': 'Patient relationship has been declined'
            }), 403
        
        # Get patient data
        patient = User.find_by_id(patient_id)
        if not patient:
            return jsonify({
                'success': False,
                'message': 'Patient not found'
            }), 404
        
        patient_data = patient.to_safe_dict()
        patient_data['relationship'] = relationship.to_safe_dict()
        
        # Get real health data
        health_data = {}
        try:
            # Get latest glucose reading
            latest_glucose = HealthData.get_latest_by_type(patient_id, 'blood_glucose')
            if latest_glucose:
                health_data['latest_glucose'] = latest_glucose.get('value')
                health_data['glucose_timestamp'] = latest_glucose.get('timestamp')
            
            # Get latest heart rate
            latest_hr = HealthData.get_latest_by_type(patient_id, 'heart_rate')
            if latest_hr:
                health_data['latest_heart_rate'] = latest_hr.get('value')
            
            # Get today's steps
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            steps_data = HealthData.get_by_date_range(patient_id, 'steps', today_start, datetime.utcnow())
            if steps_data:
                health_data['today_steps'] = sum(s.get('value', 0) for s in steps_data)
            
            # Get today's calories burned
            calories_data = HealthData.get_by_date_range(patient_id, 'active_calories', today_start, datetime.utcnow())
            if calories_data:
                health_data['today_calories'] = int(sum(c.get('value', 0) for c in calories_data))
            
            # Get average sleep (last 7 days)
            week_ago = datetime.utcnow() - timedelta(days=7)
            sleep_data = HealthData.get_by_date_range(patient_id, 'sleep', week_ago, datetime.utcnow())
            if sleep_data:
                avg_sleep = sum(s.get('value', 0) for s in sleep_data) / len(sleep_data)
                health_data['avg_sleep_hours'] = avg_sleep
            
            # Get weight
            latest_weight = HealthData.get_latest_by_type(patient_id, 'weight')
            if latest_weight:
                health_data['weight'] = latest_weight.get('value')
                # Calculate BMI if height is available
                if patient.height:
                    height_m = patient.height / 100  # assuming height in cm
                    health_data['bmi'] = latest_weight.get('value') / (height_m ** 2)
                    
        except Exception as health_error:
            logging.warning(f"Error fetching health data for patient {patient_id}: {str(health_error)}")
        
        patient_data['health_data'] = health_data
        
        # Get health info summary
        patient_data['health_info'] = {
            'glucose_level': health_data.get('latest_glucose'),
            'heart_rate': health_data.get('latest_heart_rate'),
            'last_visit': relationship.acceptance_date.isoformat() if relationship.acceptance_date else None,
        }
        
        # Get active prescriptions
        try:
            prescriptions = Prescription.get_patient_prescriptions(patient_id, status='active')
            patient_data['prescriptions'] = [p.to_safe_dict() for p in prescriptions] if prescriptions else []
            patient_data['health_info']['medications'] = len(patient_data['prescriptions'])
        except Exception as rx_error:
            logging.warning(f"Error fetching prescriptions for patient {patient_id}: {str(rx_error)}")
            patient_data['prescriptions'] = []
            patient_data['health_info']['medications'] = 0
        
        # Get consultations history
        try:
            consultations = Consultation.get_patient_consultations(patient_id)
            patient_data['consultations'] = [c.to_safe_dict() for c in consultations[:10]] if consultations else []
        except Exception as consult_error:
            logging.warning(f"Error fetching consultations for patient {patient_id}: {str(consult_error)}")
            patient_data['consultations'] = []
        
        # ========== COMPREHENSIVE HEALTH TRACKING DATA ==========
        db = get_db()
        patient_data['tracking_data'] = {}

        # Prepare alternate id (firebase uid) for fallback lookups
        alt_uid = getattr(patient, 'uid', None)

        # Helper to try multiple id formats for model finders
        def try_variants(find_fn):
            # try original patient_id, then stringified mongo id, then firebase uid
            variants = [patient_id, str(getattr(patient, '_id', ''))]
            if alt_uid:
                variants.append(alt_uid)

            for vid in variants:
                if not vid:
                    continue
                try:
                    res = find_fn(vid)
                    if res:
                        return res, vid
                except Exception:
                    continue
            return None, None
        
        # 1. Diabetes Assessment Result
        try:
            assessment = db.diabetes_assessments.find_one(
                {'userId': ObjectId(patient_id)},
                sort=[('createdAt', -1)]
            )
            if assessment:
                patient_data['tracking_data']['diabetes_assessment'] = {
                    'has_data': True,
                    'risk_level': assessment.get('prediction', {}).get('risk_level'),
                    'probability': assessment.get('prediction', {}).get('probability'),
                    'percentage': assessment.get('prediction', {}).get('percentage'),
                    'confidence': assessment.get('prediction', {}).get('confidence'),
                    'last_updated': assessment.get('updatedAt').isoformat() if assessment.get('updatedAt') else None
                }
            else:
                patient_data['tracking_data']['diabetes_assessment'] = {'has_data': False}
        except Exception as e:
            logging.warning(f"Error fetching diabetes assessment: {str(e)}")
            patient_data['tracking_data']['diabetes_assessment'] = {'has_data': False}
        
        # 2. Food Risk Assessment
        try:
            # Food baseline is stored with ObjectId user references; use the resolved Mongo _id
            mongo_id = str(getattr(patient, '_id', patient_id))
            baseline_resp = FoodBaselineAssessment.get_user_baseline(mongo_id)
            if baseline_resp and baseline_resp.get('baseline'):
                # Use mongo_id when calculating comprehensive risk
                risk_data = FoodTrackingService.calculate_comprehensive_risk(mongo_id, days=7)
                if risk_data.get('success'):
                    patient_data['tracking_data']['food_tracker'] = {
                        'has_data': True,
                        'risk_score': risk_data.get('comprehensive_risk_score'),
                        'risk_category': risk_data.get('risk_category'),
                        'baseline_risk': risk_data.get('breakdown', {}).get('baseline_risk'),
                        'daily_log_risk': risk_data.get('breakdown', {}).get('daily_log_risk'),
                        'meals_analyzed': risk_data.get('breakdown', {}).get('daily_analysis', {}).get('total_meals', 0)
                    }
                else:
                    patient_data['tracking_data']['food_tracker'] = {'has_data': True, 'baseline_only': True}
            else:
                patient_data['tracking_data']['food_tracker'] = {'has_data': False}
        except Exception as e:
            logging.warning(f"Error fetching food tracker data: {str(e)}")
            patient_data['tracking_data']['food_tracker'] = {'has_data': False}
        
        # 3. Sleep Tracking (try multiple id variants)
        try:
            sleep_service = SleepTrackingService()
            sleep_summary, used_id = try_variants(lambda vid: sleep_service.get_sleep_summary(vid))
            if sleep_summary and sleep_summary.get('has_baseline'):
                metrics = sleep_summary.get('metrics', {})
                risk = sleep_summary.get('risk_assessment', {})
                patient_data['tracking_data']['sleep_tracking'] = {
                    'has_data': True,
                    'avg_sleep_7d': metrics.get('avg_sleep_7d'),
                    'avg_sleep_30d': metrics.get('avg_sleep_30d'),
                    'risk_score': risk.get('score'),
                    'risk_category': risk.get('category'),
                    'days_tracked': metrics.get('days_with_data_7d')
                }
                # mark source as mongo
                patient_data['tracking_data']['sleep_tracking']['source'] = 'mongo'
            else:
                # Firestore fallback: if patient has firebase uid, try fetching from Firestore collections
                patient_data['tracking_data']['sleep_tracking'] = {'has_data': False}
                logging.info(f"Sleep tracking not found in Mongo for patient {patient_id}; attempting Firestore fallback (uid={alt_uid})")
                try:
                    from config.firebase_admin import get_firebase_app
                    import firebase_admin
                    from firebase_admin import firestore

                    if alt_uid:
                        fs = firestore.client(get_firebase_app())
                        # try several common collection names
                        collections_to_try = ['sleep_metrics', 'sleep_daily_records', 'sleep_baselines']
                        found = None
                        for coll in collections_to_try:
                            try:
                                docs = fs.collection(coll).where('user_id', '==', alt_uid).limit(1).get()
                                if not docs:
                                    docs = fs.collection(coll).where('uid', '==', alt_uid).limit(1).get()
                                if docs:
                                    doc = docs[0]
                                    data = doc.to_dict()
                                    # Map common fields if present
                                    patient_data['tracking_data']['sleep_tracking'] = {
                                        'has_data': True,
                                        'avg_sleep_7d': data.get('avg_sleep_7d') or data.get('avg_sleep') or None,
                                        'avg_sleep_30d': data.get('avg_sleep_30d') or None,
                                        'risk_score': data.get('risk_score') or None,
                                        'risk_category': data.get('risk_category') or None,
                                        'days_tracked': data.get('days_with_data_7d') or data.get('days_tracked') or None,
                                        'source': f'firestore:{coll}'
                                    }
                                    logging.info(f"Found sleep tracking in Firestore collection '{coll}' for uid={alt_uid}")
                                    found = True
                                    break
                            except Exception:
                                continue
                except Exception as e:
                    logging.warning(f"Firestore sleep fallback error: {str(e)}")
        except Exception as e:
            logging.warning(f"Error fetching sleep tracking data: {str(e)}")
            patient_data['tracking_data']['sleep_tracking'] = {'has_data': False}
        
        # 4. Step Counter (try multiple id variants)
        try:
            step_baseline, used_id = try_variants(lambda vid: StepBaseline.find_by_user_id(vid))
            if step_baseline:
                step_metrics = StepTrackingService.get_metrics(used_id)
                if step_metrics:
                    patient_data['tracking_data']['step_counter'] = {
                        'has_data': True,
                        'avg_steps_7d': step_metrics.get('avg_steps_7d'),
                        'avg_steps_30d': step_metrics.get('avg_steps_30d'),
                        'risk_score': step_metrics.get('risk_score'),
                        'risk_category': step_metrics.get('risk_category'),
                        'activity_level': step_metrics.get('activity_level')
                    }
                else:
                    patient_data['tracking_data']['step_counter'] = {'has_data': True, 'baseline_only': True}
                # mark source as mongo
                patient_data['tracking_data']['step_counter']['source'] = 'mongo'
            else:
                patient_data['tracking_data']['step_counter'] = {'has_data': False}
        except Exception as e:
            logging.warning(f"Error fetching step counter data: {str(e)}")
            patient_data['tracking_data']['step_counter'] = {'has_data': False}
        
        # 5. Smoking Intake (try multiple id variants)
        try:
            smoking_service = SmokingTrackingService()
            smoking_summary, used_id = try_variants(lambda vid: smoking_service.get_smoking_summary(vid))
            if smoking_summary and smoking_summary.get('has_baseline'):
                baseline = smoking_summary.get('baseline', {})
                metrics = smoking_summary.get('metrics', {})
                risk = smoking_summary.get('risk_assessment', {})
                patient_data['tracking_data']['smoking_intake'] = {
                    'has_data': True,
                    'smoking_status': baseline.get('current_status'),
                    'avg_cigarettes_7d': metrics.get('avg_cigarettes_7d'),
                    'risk_score': risk.get('risk_score'),
                    'risk_category': risk.get('risk_category'),
                    'explanation': risk.get('explanation')
                }
                patient_data['tracking_data']['smoking_intake']['source'] = 'mongo'
            else:
                patient_data['tracking_data']['smoking_intake'] = {'has_data': False}
        except Exception as e:
            logging.warning(f"Error fetching smoking intake data: {str(e)}")
            patient_data['tracking_data']['smoking_intake'] = {'has_data': False}
        
        # 6. Alcohol Intake (try multiple id variants)
        try:
            alcohol_baseline, used_id = try_variants(lambda vid: AlcoholBaseline.find_by_user_id(vid))
            if alcohol_baseline:
                alcohol_metrics = AlcoholMetrics.find_by_user_id(used_id)

                def _model_to_dict(obj, keys):
                    if not obj:
                        return {}
                    if isinstance(obj, dict):
                        return obj
                    if hasattr(obj, 'to_dict') and callable(obj.to_dict):
                        try:
                            return obj.to_dict()
                        except Exception:
                            pass
                    # Fallback: pick attributes
                    out = {}
                    for k in keys:
                        out[k] = getattr(obj, k, None)
                    return out

                keys = ['drinks_per_week_7d', 'drinks_per_week_30d', 'risk_score', 'risk_category', 'consumption_pattern']
                am = _model_to_dict(alcohol_metrics, keys)
                if am and any(am.get(k) is not None for k in keys):
                    patient_data['tracking_data']['alcohol_intake'] = {
                        'has_data': True,
                        'drinks_per_week_7d': am.get('drinks_per_week_7d'),
                        'drinks_per_week_30d': am.get('drinks_per_week_30d'),
                        'risk_score': am.get('risk_score'),
                        'risk_category': am.get('risk_category'),
                        'consumption_pattern': am.get('consumption_pattern')
                    }
                    patient_data['tracking_data']['alcohol_intake']['source'] = 'mongo'
                else:
                    patient_data['tracking_data']['alcohol_intake'] = {'has_data': True, 'baseline_only': True, 'source': 'mongo'}
            else:
                # Firestore fallback for alcohol: check Firestore collections by firebase uid
                patient_data['tracking_data']['alcohol_intake'] = {'has_data': False}
                logging.info(f"Alcohol tracking not found in Mongo for patient {patient_id}; attempting Firestore fallback (uid={alt_uid})")
                try:
                    from config.firebase_admin import get_firebase_app
                    import firebase_admin
                    from firebase_admin import firestore

                    if alt_uid:
                        fs = firestore.client(get_firebase_app())
                        collections_to_try = ['alcohol_metrics', 'alcohol_daily_records', 'alcohol_baselines']
                        for coll in collections_to_try:
                            try:
                                docs = fs.collection(coll).where('user_id', '==', alt_uid).limit(1).get()
                                if not docs:
                                    docs = fs.collection(coll).where('uid', '==', alt_uid).limit(1).get()
                                if docs:
                                    doc = docs[0]
                                    data = doc.to_dict()
                                    patient_data['tracking_data']['alcohol_intake'] = {
                                        'has_data': True,
                                        'drinks_per_week_7d': data.get('avg_drinks_per_week_7d') or data.get('drinks_per_week') or None,
                                        'drinks_per_week_30d': data.get('avg_drinks_per_week_30d') or None,
                                        'risk_score': data.get('risk_score') or None,
                                        'risk_category': data.get('risk_category') or None,
                                        'consumption_pattern': data.get('consumption_pattern') or data.get('drinking_pattern') or None,
                                        'source': f'firestore:{coll}'
                                    }
                                    logging.info(f"Found alcohol tracking in Firestore collection '{coll}' for uid={alt_uid}")
                                    break
                            except Exception:
                                continue
                except Exception as e:
                    logging.warning(f"Firestore alcohol fallback error: {str(e)}")
        except Exception as e:
            logging.warning(f"Error fetching alcohol intake data: {str(e)}")
            patient_data['tracking_data']['alcohol_intake'] = {'has_data': False}
        
        return jsonify({
            'success': True,
            'data': patient_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting patient details: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get patient details'
        }), 500
