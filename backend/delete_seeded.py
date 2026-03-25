"""
GlycoFit Seeded User Cleanup Script
=====================================
Deletes all seeded users and their related data from Firebase + MongoDB.

Usage:
    python delete_seeded.py          # Interactive — choose which user to delete
    python delete_seeded.py --all    # Delete ALL seeded users at once

Reads from .seeded_users.json to know which users/data to remove.
"""

import os
import sys
import json
import logging
from datetime import datetime
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from flask import Flask

def create_minimal_app():
    """Create a minimal Flask app just for DB + Firebase init."""
    app = Flask(__name__)
    app.config['DB_URI'] = os.getenv('DB_URI', 'mongodb://localhost:27017/glycofit')
    return app

app = create_minimal_app()

from config.database import init_db, get_db
from config.firebase_admin import init_firebase

with app.app_context():
    init_db(app)
    init_firebase()

from firebase_admin import auth as firebase_auth

SEED_TRACKER_FILE = os.path.join(os.path.dirname(__file__), '.seeded_users.json')

# ─── Deletion Functions ─────────────────────────────────────────────────────────

def delete_firebase_user(uid):
    """Delete a Firebase Auth user by UID."""
    try:
        firebase_auth.delete_user(uid)
        print(f"    [x] Firebase user deleted: {uid}")
        return True
    except firebase_auth.UserNotFoundError:
        print(f"    [-] Firebase user not found (already deleted?): {uid}")
        return True
    except Exception as e:
        print(f"    [!] Failed to delete Firebase user {uid}: {e}")
        return False


def delete_user_data(db, firebase_uid, mongo_user_id):
    """Delete ALL data related to this user from MongoDB."""
    oid = ObjectId(mongo_user_id)
    uid_str = firebase_uid
    total_deleted = 0

    # Collections and their user identifier field
    # Some collections use MongoDB ObjectId, others use Firebase UID string
    collections_by_oid = [
        ('users', '_id', oid),
        ('diabetes_assessments', 'userId', oid),
        ('food_baseline_assessments', 'user_id', oid),
        ('user_meals', 'user_id', oid),
        ('chatbot_messages', 'user_id', oid),
    ]

    collections_by_uid = [
        ('user_activities', 'uid', uid_str),
        ('health_data', 'user_id', uid_str),
    ]

    # Collections that use MongoDB ObjectId string as identifier
    collections_by_oid_str = [
        ('sleep_baselines', 'user_id', mongo_user_id),
        ('sleep_daily_records', 'user_id', mongo_user_id),
        ('smoking_baselines', 'user_id', mongo_user_id),
        ('smoking_intake', 'user_id', mongo_user_id),
        ('smoking_daily_records', 'user_id', mongo_user_id),
        ('alcohol_baselines', 'user_id', mongo_user_id),
        ('alcohol_daily_records', 'user_id', mongo_user_id),
        ('step_baselines', 'user_id', mongo_user_id),
        ('step_metrics', 'user_id', mongo_user_id),
        ('overall_risk_assessments', 'user_id', mongo_user_id),
        ('patient_physicians', 'patient_id', mongo_user_id),
        ('appointments', 'patient_id', mongo_user_id),
        ('consultations', 'patient_id', mongo_user_id),
        ('prescriptions', 'patient_id', mongo_user_id),
    ]

    # Delete by ObjectId
    for coll_name, field, value in collections_by_oid:
        try:
            result = db[coll_name].delete_many({field: value})
            count = result.deleted_count
            if count > 0:
                print(f"    [x] {coll_name}: {count} documents deleted")
            total_deleted += count
        except Exception as e:
            print(f"    [!] Error deleting from {coll_name}: {e}")

    # Delete by Firebase UID string
    for coll_name, field, value in collections_by_uid:
        try:
            result = db[coll_name].delete_many({field: value})
            count = result.deleted_count
            if count > 0:
                print(f"    [x] {coll_name}: {count} documents deleted")
            total_deleted += count
        except Exception as e:
            print(f"    [!] Error deleting from {coll_name}: {e}")

    # Delete by ObjectId string (for patient references)
    for coll_name, field, value in collections_by_oid_str:
        try:
            result = db[coll_name].delete_many({field: value})
            count = result.deleted_count
            if count > 0:
                print(f"    [x] {coll_name}: {count} documents deleted")
            total_deleted += count
        except Exception as e:
            print(f"    [!] Error deleting from {coll_name}: {e}")

    # Also try deleting chat messages where this user is a sender
    try:
        result = db.chat_messages.delete_many({'sender_id': mongo_user_id})
        count = result.deleted_count
        if count > 0:
            print(f"    [x] chat_messages (as sender): {count} documents deleted")
        total_deleted += count
    except Exception:
        pass

    print(f"    [=] Total MongoDB documents deleted: {total_deleted}")
    return total_deleted


# ─── Main Execution ─────────────────────────────────────────────────────────────

def load_seed_records():
    """Load seed records from tracker file."""
    if not os.path.exists(SEED_TRACKER_FILE):
        return []
    with open(SEED_TRACKER_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def save_seed_records(records):
    """Save remaining seed records back to tracker."""
    with open(SEED_TRACKER_FILE, 'w') as f:
        json.dump(records, f, indent=2, default=str)


def delete_single_user(record, db):
    """Delete a single seeded user and their data."""
    uid = record['firebase_uid']
    mongo_id = record['mongo_user_id']
    email = record.get('email', 'unknown')
    name = f"{record.get('first_name', '')} {record.get('last_name', '')}".strip()

    print(f"\n  Deleting: {name} ({email})")
    print(f"    Firebase UID:   {uid}")
    print(f"    MongoDB ID:     {mongo_id}")
    print()

    # Delete from MongoDB first
    print("  [MongoDB] Removing all related data...")
    delete_user_data(db, uid, mongo_id)

    # Delete from Firebase
    print("  [Firebase] Removing auth user...")
    delete_firebase_user(uid)

    print(f"  Done deleting {name}.\n")


def main():
    print("\n" + "=" * 60)
    print("  GlycoFit Seeded User Cleanup")
    print("=" * 60)

    records = load_seed_records()

    if not records:
        print("\n  No seeded users found in tracker file.")
        print(f"  Tracker: {SEED_TRACKER_FILE}")
        print("=" * 60 + "\n")
        return

    delete_all = '--all' in sys.argv

    print(f"\n  Found {len(records)} seeded user(s):\n")
    for i, r in enumerate(records):
        name = f"{r.get('first_name', '')} {r.get('last_name', '')}".strip()
        print(f"    [{i + 1}] {name} — {r.get('email', 'N/A')}  (seeded: {r.get('seeded_at', 'N/A')})")

    print()

    if delete_all:
        confirm = input("  Delete ALL seeded users? This cannot be undone. (y/n): ").strip().lower()
        if confirm != 'y':
            print("  Aborted.")
            return

        db = get_db()
        for record in records:
            delete_single_user(record, db)
        records = []
    else:
        choice = input(f"  Enter number to delete (1-{len(records)}), or 'all', or 'q' to quit: ").strip().lower()

        if choice == 'q':
            print("  Aborted.")
            return

        if choice == 'all':
            confirm = input("  Delete ALL seeded users? This cannot be undone. (y/n): ").strip().lower()
            if confirm != 'y':
                print("  Aborted.")
                return
            db = get_db()
            for record in records:
                delete_single_user(record, db)
            records = []
        else:
            try:
                idx = int(choice) - 1
                if idx < 0 or idx >= len(records):
                    print("  Invalid selection.")
                    return
            except ValueError:
                print("  Invalid input.")
                return

            confirm = input(f"  Delete user #{idx + 1}? (y/n): ").strip().lower()
            if confirm != 'y':
                print("  Aborted.")
                return

            db = get_db()
            delete_single_user(records[idx], db)
            records.pop(idx)

    # Update tracker file
    save_seed_records(records)

    if not records:
        print("  All seeded users have been removed.")
        # Clean up tracker file
        if os.path.exists(SEED_TRACKER_FILE):
            os.remove(SEED_TRACKER_FILE)
            print(f"  Tracker file removed: {SEED_TRACKER_FILE}")
    else:
        print(f"  {len(records)} seeded user(s) remaining.")

    print("=" * 60 + "\n")


if __name__ == '__main__':
    main()
