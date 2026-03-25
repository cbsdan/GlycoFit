"""
Smoking seeder — smoking baseline (3 profiles: never/former/current)
and smoking intake with consistent sessions.
"""

import random
from datetime import datetime
from bson import ObjectId

from seeders.helpers import random_seed_datetime, weighted_choice


# ─── Profile selection ──────────────────────────────────────────────────────────

SMOKING_PROFILES = ['never', 'former', 'current']
SMOKING_WEIGHTS = [0.70, 0.15, 0.15]

# cigarettes_per_day enum values from the model
CPD_ENUM = ['0', '1-5', '6-10', '11-20', '>20']


def _cpd_to_midpoint(cpd_str):
    """Convert cigarettes_per_day enum to a numeric midpoint for pack-year calc."""
    return {'0': 0, '1-5': 3, '6-10': 8, '11-20': 15, '>20': 25}[cpd_str]


def _pick_smoking_profile():
    """Select a smoking profile and generate consistent baseline + intake data."""
    status = weighted_choice(SMOKING_PROFILES, SMOKING_WEIGHTS)

    if status == 'never':
        return {
            'status': 'never',
            'years_smoked': 0,
            'typical_cigarettes_per_day': 0,
            'quit_date': None,
            'start_smoking_age': None,
            'cpd_enum': '0',
            'pack_years': 0.0,
        }

    start_age = random.randint(14, 25)

    if status == 'former':
        years = random.randint(2, 20)
        cpd = weighted_choice(['1-5', '6-10', '11-20', '>20'], [0.30, 0.35, 0.25, 0.10])
        mid = _cpd_to_midpoint(cpd)
        pack_years = round((mid / 20) * years, 2)
        # quit_date somewhere in the past 1-10 years
        quit_year = random.randint(2016, 2025)
        quit_month = random.randint(1, 12)
        quit_date = f"{quit_year}-{quit_month:02d}-01"
        return {
            'status': 'former',
            'years_smoked': years,
            'typical_cigarettes_per_day': mid,
            'quit_date': quit_date,
            'start_smoking_age': start_age,
            'cpd_enum': cpd,
            'pack_years': pack_years,
        }

    # current
    years = random.randint(1, 25)
    cpd = weighted_choice(['1-5', '6-10', '11-20', '>20'], [0.25, 0.35, 0.28, 0.12])
    mid = _cpd_to_midpoint(cpd)
    pack_years = round((mid / 20) * years, 2)
    return {
        'status': 'current',
        'years_smoked': years,
        'typical_cigarettes_per_day': mid,
        'quit_date': None,
        'start_smoking_age': start_age,
        'cpd_enum': cpd,
        'pack_years': pack_years,
    }


# ─── Seeders ────────────────────────────────────────────────────────────────────

def seed_smoking_baseline(db, uid_str):
    """Seed a randomized smoking baseline (uses Firebase UID). Returns profile dict."""
    profile = _pick_smoking_profile()
    doc = {
        'user_id': uid_str,
        'smoking_status': profile['status'],
        'years_smoked': profile['years_smoked'],
        'typical_cigarettes_per_day': profile['typical_cigarettes_per_day'],
        'quit_date': profile['quit_date'],
        'start_smoking_age': profile['start_smoking_age'],
        'created_at': random_seed_datetime(),
        'is_locked': True,
    }
    result = db.smoking_baselines.insert_one(doc)
    print(f"  [+] Smoking baseline created: {result.inserted_id} (status: {profile['status']})")
    return profile


def seed_smoking_intake(db, uid_str, profile):
    """Seed smoking intake record consistent with profile."""
    created = random_seed_datetime()
    status = profile['status']

    sessions = []
    if status != 'never':
        session_start_year = 2026 - profile['years_smoked']
        start_date = f"{session_start_year}-01-15T00:00:00"
        end_date = profile['quit_date'] + 'T00:00:00' if profile['quit_date'] else None
        sessions.append({
            'session_id': str(ObjectId()),
            'start_date': start_date,
            'end_date': end_date,
            'cigarettes_per_day': profile['cpd_enum'],
            'duration_years': profile['years_smoked'],
            'pack_years': profile['pack_years'],
            'status': 'active' if status == 'current' else 'quit',
            'recorded_at': created,
        })

    years_since_quit = None
    if status == 'former' and profile['quit_date']:
        quit_year = int(profile['quit_date'][:4])
        years_since_quit = 2026 - quit_year

    doc = {
        'user_id': uid_str,
        'current_status': status,
        'cumulative_pack_years': profile['pack_years'],
        'years_since_quit': years_since_quit,
        'smoking_sessions': sessions,
        'created_at': created,
        'updated_at': created,
    }
    result = db.smoking_intake.insert_one(doc)
    print(f"  [+] Smoking intake created: {result.inserted_id}")
    return result.inserted_id
