"""
User profile seeder — Firebase Auth, MongoDB user document, and diabetes assessment.
All diabetes assessment answers are randomized with realistic weighted distributions.
"""

import random
from datetime import timedelta
from firebase_admin import auth as firebase_auth

from seeders.helpers import (
    random_seed_datetime, compute_bmi, age_to_brfss_category,
    sex_to_brfss, weighted_choice, SEED_DATE_END,
)


def create_firebase_user(email, password, first_name, last_name):
    """Create Firebase Auth user and return UID."""
    try:
        try:
            existing = firebase_auth.get_user_by_email(email)
            print(f"  [!] Firebase user already exists with UID: {existing.uid}")
            return existing.uid
        except firebase_auth.UserNotFoundError:
            pass

        user_record = firebase_auth.create_user(
            email=email,
            password=password,
            display_name=f"{first_name} {last_name}",
            email_verified=True,
        )
        print(f"  [+] Firebase user created: {user_record.uid}")
        return user_record.uid
    except Exception as e:
        print(f"  [!] Firebase user creation failed: {e}")
        raise


def create_mongo_user(db, uid, config):
    """Create MongoDB user document. Returns the inserted _id."""
    existing = db.users.find_one({'uid': uid})
    if existing:
        print(f"  [!] MongoDB user already exists: {existing['_id']}")
        return existing['_id']

    created = random_seed_datetime()
    updated = created + timedelta(hours=random.randint(1, 48))
    if updated.hour < 7:
        updated = updated.replace(hour=random.randint(7, 18))
    elif updated.hour >= 19:
        updated = updated.replace(hour=random.randint(7, 18))
    if updated > SEED_DATE_END:
        updated = SEED_DATE_END.replace(
            hour=random.randint(7, 18),
            minute=random.randint(0, 59),
            second=random.randint(0, 59),
            microsecond=0,
        )

    user_doc = {
        'uid': uid,
        'first_name': config['first_name'],
        'last_name': config['last_name'],
        'email': config['email'].lower().strip(),
        'role': 'user',
        'avatar': {'public_id': None, 'url': None},
        'push_tokens': [],
        'enable_push_notifications': True,
        'permission_token': None,
        'multi_factor_enabled': False,
        'disable_history': [],
        'disclaimer_accepted': config.get('disclaimer_accepted', True),
        'age': config['age'],
        'sex': config['sex'],
        'height': config['height'],
        'weight': config['weight'],
        'diagnosis_status': config['diagnosis_status'],
        'created_at': created,
        'updated_at': updated,
    }
    result = db.users.insert_one(user_doc)
    print(f"  [+] MongoDB user created: {result.inserted_id}")
    return result.inserted_id


# ─── Diabetes Assessment (fully randomized) ────────────────────────────────────

def _random_binary(prob_one=0.5):
    """Return 0 or 1 with given probability of 1."""
    return 1 if random.random() < prob_one else 0


def _random_skewed_int(low, high, skew_low=True):
    """Return an int skewed toward the low end (or high end)."""
    if skew_low:
        # Use triangular distribution skewing toward low
        return int(round(random.triangular(low, high, low)))
    return int(round(random.triangular(low, high, high)))


def _build_randomized_answers(config):
    """Build a fully randomized BRFSS-style answer dict based on user demographics."""
    bmi = compute_bmi(config['height'], config['weight'])
    age = config['age']
    age_cat = age_to_brfss_category(age)
    sex_val = sex_to_brfss(config['sex'])
    activity_seed = config.get('activity_seed', 'full')

    # Age-correlated probabilities
    age_risk = min(age / 100, 0.7)  # older → higher risk conditions
    bmi_risk = min(bmi / 50, 0.6)

    answers = {
        'HighBP': _random_binary(0.15 + age_risk * 0.5),
        'HighChol': _random_binary(0.20 + bmi_risk * 0.4),
        'CholCheck': _random_binary(0.92),
        'BMI': bmi,
        'Smoker': _random_binary(0.15),
        'Stroke': _random_binary(0.02 + age_risk * 0.05),
        'HeartDiseaseorAttack': _random_binary(0.03 + age_risk * 0.06),
        'PhysActivity': _random_binary(0.85 if activity_seed == 'full' else (0.55 if activity_seed == 'few' else 0.3)),
        'Fruits': _random_binary(0.60),
        'Veggies': _random_binary(0.65),
        'HvyAlcoholConsump': _random_binary(0.07),
        'AnyHealthcare': _random_binary(0.90),
        'NoDocbcCost': _random_binary(0.18),
        'GenHlth': weighted_choice([1, 2, 3, 4, 5], [0.10, 0.30, 0.35, 0.18, 0.07]),
        'MentHlth': _random_skewed_int(0, 30, skew_low=True),
        'PhysHlth': _random_skewed_int(0, 30, skew_low=True),
        'DiffWalk': _random_binary(0.05 + age_risk * 0.15),
        'Sex': sex_val,
        'Age': age_cat,
        'Education': weighted_choice([1, 2, 3, 4, 5, 6], [0.02, 0.05, 0.10, 0.25, 0.35, 0.23]),
        'Income': weighted_choice([1, 2, 3, 4, 5, 6, 7, 8], [0.04, 0.06, 0.10, 0.15, 0.20, 0.20, 0.15, 0.10]),
    }
    return answers


def try_predict(answers):
    """Try to run the actual ML prediction; return prediction dict or None."""
    try:
        from services.diabetes_service import DiabetesPredictionService
        svc = DiabetesPredictionService()
        if svc.initialize():
            return svc.predict(answers)
    except Exception as e:
        print(f"  [!] ML prediction unavailable ({e}), skipping prediction.")
    return None


def seed_diabetes_assessment(db, user_object_id, config):
    """Seed a diabetes risk assessment with randomized answers."""
    created = random_seed_datetime()
    answers = _build_randomized_answers(config)

    prediction = try_predict(answers)
    if prediction:
        print(f"  [+] ML prediction: {prediction['risk_level']} ({prediction['probability']:.2%})")
    else:
        print(f"  [!] ML model not available — assessment saved without prediction")

    assessment = {
        'userId': user_object_id,
        'answers': answers,
        'prediction': prediction,
        'createdAt': created,
        'updatedAt': created,
    }
    result = db.diabetes_assessments.insert_one(assessment)
    print(f"  [+] Diabetes assessment created: {result.inserted_id}")
    return result.inserted_id
