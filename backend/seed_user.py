"""
GlycoFit User Seeder Script
============================
Creates test users with Firebase Auth + MongoDB profile and all related data.
User profiles are loaded from seed_users.json (same directory).
All baseline data is fully randomized per user with realistic distributions.

Usage:
    python seed_user.py              # seed all users in seed_users.json
    python seed_user.py 0            # seed only the first user (index 0)
    python seed_user.py 1            # seed only the second user (index 1)

Requirements:
    - .env file with DB_URI and Firebase credentials
    - Firebase Admin SDK initialized
    - seed_users.json in the same directory
"""

import os
import sys
import json
import random
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask

load_dotenv()


def create_minimal_app():
    app = Flask(__name__)
    app.config['DB_URI'] = os.getenv('DB_URI', 'mongodb://localhost:27017/glycofit')
    return app

app = create_minimal_app()

from config.database import init_db, get_db
from config.firebase_admin import init_firebase

with app.app_context():
    init_db(app)
    init_firebase()

# ─── Import seeders ────────────────────────────────────────────────────────────

from seeders.helpers import (
    SEED_DATE_START, SEED_DATE_END, SEED_DAYS,
    SEED_USERS_FILE, compute_bmi, save_seed_record,
)
from seeders.user_profile import create_firebase_user, create_mongo_user, seed_diabetes_assessment
from seeders.food_seeder import seed_food_baseline, seed_user_meals
from seeders.sleep_seeder import seed_sleep_baseline, seed_sleep_daily_records
from seeders.smoking_seeder import seed_smoking_baseline, seed_smoking_intake
from seeders.alcohol_seeder import seed_alcohol_baseline, seed_alcohol_daily_records
from seeders.activity_seeder import seed_step_baseline, seed_user_activities
from services.step_tracking_service import StepTrackingService
from seeders.risk_seeder import seed_overall_risk_assessment
from seeders.chatbot_seeder import seed_chatbot_messages

# ─── Load user profiles ────────────────────────────────────────────────────────


def load_seed_users():
    """Load user profiles from seed_users.json."""
    if not os.path.exists(SEED_USERS_FILE):
        print(f"  [!] seed_users.json not found at {SEED_USERS_FILE}")
        sys.exit(1)
    with open(SEED_USERS_FILE, 'r') as f:
        users = json.load(f)
    if not isinstance(users, list) or len(users) == 0:
        print("  [!] seed_users.json must be a non-empty JSON array.")
        sys.exit(1)
    for u in users:
        u.setdefault('disclaimer_accepted', True)
    return users


# ─── Orchestrator ───────────────────────────────────────────────────────────────


def seed_one_user(db, cfg, index, total):
    """Seed a single user and all related data.

    Non-diagnosed users get:
        - All lifestyle baselines (food, sleep, smoking, step, alcohol)
        - Diabetes assessment + overall risk assessment
        - Daily tracking records (meals, sleep, alcohol, activities)
        - Chatbot messages

    Diagnosed users (prediabetes / type2_diabetes) get:
        - Only daily tracking data (meals with food_type)
    """
    label = f"[User {index + 1}/{total}]"
    bmi = compute_bmi(cfg['height'], cfg['weight'])
    diagnosis = cfg['diagnosis_status']
    is_diagnosed = diagnosis in ('prediabetes', 'type2_diabetes')

    print(f"\n{label} {cfg['first_name']} {cfg['last_name']}")
    print(f"    Email:     {cfg['email']}")
    print(f"    Age:       {cfg['age']}  |  Sex: {cfg['sex']}")
    print(f"    Height:    {cfg['height']} cm  |  Weight: {cfg['weight']} kg  |  BMI: {bmi}")
    print(f"    Diagnosis: {diagnosis}")
    print(f"    Password:  {cfg['password']}")
    print()

    # 1. Create Firebase user
    print(f"  [1] Creating Firebase Auth user...")
    uid = create_firebase_user(cfg['email'], cfg['password'], cfg['first_name'], cfg['last_name'])

    # 2. Create MongoDB user
    print(f"  [2] Creating MongoDB user...")
    user_oid = create_mongo_user(db, uid, cfg)
    user_oid_str = str(user_oid)

    # Save tracking record early so delete_seeded.py can clean up even if seeding fails partway
    seed_record = {
        'firebase_uid': uid,
        'mongo_user_id': user_oid_str,
        'email': cfg['email'],
        'first_name': cfg['first_name'],
        'last_name': cfg['last_name'],
        'seeded_at': datetime.utcnow().isoformat(),
    }
    save_seed_record(seed_record)

    # ── Diagnosed users: only daily tracking data (meals) ─────────────────────
    if is_diagnosed:
        print(f"  [3] Creating user meals (daily food tracking)...")
        seed_user_meals(db, user_oid, days=SEED_DAYS)
        print(f"\n  {label} Done (diagnosed: {diagnosis})  —  UID: {uid}  |  Email: {cfg['email']}")
        return uid, user_oid_str

    # ── Non-diagnosed users: full baselines + assessments + daily tracking ─────

    # 3. Diabetes assessment
    print(f"  [3] Creating diabetes assessment...")
    seed_diabetes_assessment(db, user_oid, cfg)

    # 4. Food baseline
    print(f"  [4] Creating food baseline assessment...")
    seed_food_baseline(db, user_oid)

    # 5. User meals
    print(f"  [5] Creating user meals ({SEED_DAYS} days)...")
    seed_user_meals(db, user_oid, days=SEED_DAYS)

    # 6. Sleep baseline + daily records
    print(f"  [6] Creating sleep baseline + daily records...")
    sleep_doc = seed_sleep_baseline(db, user_oid_str)
    seed_sleep_daily_records(db, user_oid_str, sleep_doc, days=SEED_DAYS)

    # 7. Smoking baseline + intake
    print(f"  [7] Creating smoking baseline & intake...")
    smoking_profile = seed_smoking_baseline(db, user_oid_str)
    seed_smoking_intake(db, user_oid_str, smoking_profile)

    # 8. Alcohol baseline + daily records
    print(f"  [8] Creating alcohol baseline + daily records...")
    alcohol_profile = seed_alcohol_baseline(db, user_oid_str, cfg)
    seed_alcohol_daily_records(db, user_oid_str, alcohol_profile, cfg, days=SEED_DAYS)

    # 9. Step baseline + user activities (varied by activity_seed)
    # Age 45+ gets no daily step records; everyone is capped at 'few' or 'none'
    age = cfg.get('age', 0)
    activity_mode = cfg.get('activity_seed', 'few')
    if activity_mode not in ('few', 'none'):
        activity_mode = random.choice(['few', 'none'])
    step_profile = seed_step_baseline(db, user_oid_str)
    if age >= 45:
        print(f"  [9] Step baseline created — daily records skipped (age {age} ≥ 45)")
    else:
        print(f"  [9] Creating step baseline & activities (mode: {activity_mode})...")
        # user_activities.uid is keyed by Firebase UID (activity_controller uses firebase_user.uid)
        seed_user_activities(db, uid, step_profile, days=SEED_DAYS, activity_mode=activity_mode)
    # Compute step metrics so step_metrics collection is populated for admin dashboard
    print(f"  [9b] Computing step metrics...")
    try:
        StepTrackingService.compute_metrics(user_oid_str)
    except Exception as _e:
        print(f"  [!] Step metrics computation failed (non-fatal): {_e}")

    # 10. Overall risk assessment
    print(f"  [10] Creating overall risk assessment...")
    seed_overall_risk_assessment(db, user_oid_str, cfg)

    # 11. Chatbot messages
    print(f"  [11] Creating chatbot messages...")
    seed_chatbot_messages(db, user_oid)

    print(f"\n  {label} Done  —  UID: {uid}  |  Email: {cfg['email']}")
    return uid, user_oid_str


def main():
    print("\n" + "=" * 60)
    print("  GlycoFit User Seeder")
    print("=" * 60)

    users = load_seed_users()

    # Optional: seed a single user by index  (e.g. python seed_user.py 0)
    if len(sys.argv) > 1:
        try:
            idx = int(sys.argv[1])
            if idx < 0 or idx >= len(users):
                print(f"  [!] Index {idx} out of range. seed_users.json has {len(users)} user(s) (0-{len(users)-1}).")
                return
            users = [users[idx]]
            print(f"  Seeding user at index {idx} only.")
        except ValueError:
            print(f"  [!] Invalid argument '{sys.argv[1]}'. Pass a numeric index or no argument for all.")
            return

    total = len(users)
    print(f"\n  Users to seed: {total}")
    print(f"  Date range:    {SEED_DATE_START.strftime('%b %d')} — {SEED_DATE_END.strftime('%b %d, %Y')}")
    print(f"  Source file:   {SEED_USERS_FILE}")

    # Preview all users
    for i, cfg in enumerate(users):
        bmi = compute_bmi(cfg['height'], cfg['weight'])
        print(f"\n  [{i}] {cfg['first_name']} {cfg['last_name']}  |  {cfg['email']}")
        print(f"      Age: {cfg['age']}  Sex: {cfg['sex']}  BMI: {bmi}  Diagnosis: {cfg['diagnosis_status']}")

    print()
    confirm = input("  Proceed with seeding? (y/n): ").strip().lower()
    if confirm != 'y':
        print("  Aborted.")
        return

    db = get_db()
    results = []

    for i, cfg in enumerate(users):
        uid, oid = seed_one_user(db, cfg, i, total)
        results.append((cfg['email'], uid, oid))

    print("\n" + "=" * 60)
    print(f"  Seeding complete! ({len(results)} user(s))")
    for email, uid, oid in results:
        print(f"    {email}  →  UID: {uid}")
    print(f"\n  Tracking file: {SEED_USERS_FILE.replace('seed_users.json', '.seeded_users.json')}")
    print(f"  Run 'python delete_seeded.py' to remove seeded users and all data.")
    print("=" * 60 + "\n")


if __name__ == '__main__':
    main()
