"""
Activity seeder — step baseline, user activity records (with activity_mode),
and health data (active calories only).
"""

import random
from datetime import datetime, timedelta, timezone

from seeders.helpers import (
    random_seed_datetime, weighted_choice, SEED_DATE_END, SEED_DAYS,
)

# ─── Activity level thresholds ──────────────────────────────────────────────────

ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']
WORK_TYPES = ['desk', 'standing', 'active', 'physical']


def _steps_to_activity_level(steps):
    if steps < 3000:
        return 'sedentary'
    elif steps < 6000:
        return 'lightly_active'
    elif steps < 10000:
        return 'moderately_active'
    elif steps < 13000:
        return 'very_active'
    return 'extremely_active'


def _build_step_profile():
    """Generate a consistent step baseline profile."""
    avg_steps = random.randint(2000, 15000)
    level = _steps_to_activity_level(avg_steps)

    # Days active and exercise minutes correlated with step count
    level_idx = ACTIVITY_LEVELS.index(level)
    days_active = min(7, max(0, level_idx + random.randint(0, 3)))
    exercise_min = min(420, max(0, level_idx * 60 + random.randint(-30, 60)))
    work_type = weighted_choice(WORK_TYPES, [0.45, 0.25, 0.20, 0.10])

    return {
        'avg_steps': avg_steps,
        'level': level,
        'days_active': days_active,
        'exercise_min': exercise_min,
        'work_type': work_type,
    }


# ─── Seeders ────────────────────────────────────────────────────────────────────

def seed_step_baseline(db, uid_str):
    """Seed a randomized step baseline (uses MongoDB ObjectId string). Returns profile dict."""
    profile = _build_step_profile()
    created = random_seed_datetime()
    doc = {
        'user_id': uid_str,
        'baseline_avg_daily_steps': profile['avg_steps'],
        'baseline_activity_level': profile['level'],
        'baseline_days_active_per_week': profile['days_active'],
        'baseline_exercise_minutes_per_week': profile['exercise_min'],
        'baseline_work_type': profile['work_type'],
        'created_at': created,
        'updated_at': None,
    }
    result = db.step_baselines.insert_one(doc)
    print(f"  [+] Step baseline created: {result.inserted_id} "
          f"(avg {profile['avg_steps']} steps, {profile['level']})")
    return profile


def seed_user_activities(db, uid_str, step_profile, days=None, activity_mode='full'):
    """Seed user activity (step) records centered around the baseline.

    activity_mode:
        'full' - records for every day in the range
        'few'  - 2-3 records on random dates
        'none' - no records at all
    """
    if activity_mode == 'none':
        print(f"  [+] User activities: skipped (mode: none)")
        return 0

    if days is None:
        days = SEED_DAYS
    days = min(days, SEED_DAYS)

    if activity_mode == 'few':
        all_days = list(range(days))
        selected = sorted(random.sample(all_days, k=min(random.randint(2, 3), len(all_days))))
    else:
        selected = list(range(days))

    avg_steps = step_profile['avg_steps']
    inserted = 0
    end_date = SEED_DATE_END.date()
    for i in selected:
        d = end_date - timedelta(days=i)
        dt = datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)
        # Steps centered on baseline ± 30%, clamped 500–25000
        steps = int(random.gauss(avg_steps, avg_steps * 0.2))
        steps = max(500, min(25000, steps))
        distance = round(steps * 0.0008, 2)
        active_cal = round(steps * 0.04, 1)
        total_cal = round(active_cal + random.uniform(1500, 1800), 1)
        rec_time = random_seed_datetime()
        doc = {
            'uid': uid_str,
            'date': dt,
            'activity_type': 'daily',
            'steps': steps,
            'distance': distance,
            'active_calories': active_cal,
            'total_calories': total_cal,
            'source': 'seed',
            'updated_at': rec_time,
            'last_synced_at': rec_time,
            'created_at': rec_time,
        }
        db.user_activities.insert_one(doc)
        inserted += 1
    print(f"  [+] User activities created: {inserted} (mode: {activity_mode})")
    return inserted


def seed_health_data(db, uid_str, days=None):
    """Seed health data records (active calories only)."""
    if days is None:
        days = SEED_DAYS
    days = min(days, SEED_DAYS)
    inserted = 0
    end_dt = SEED_DATE_END
    for i in range(days):
        day = end_dt - timedelta(days=i)
        rec_time = random_seed_datetime()
        doc = {
            'user_id': uid_str,
            'data_type': 'active_calories',
            'value': float(random.randint(150, 500)),
            'unit': 'kcal',
            'timestamp': day.replace(hour=23, minute=59),
            'metadata': {},
            'synced_at': rec_time,
            'created_at': rec_time,
        }
        db.health_data.insert_one(doc)
        inserted += 1
    print(f"  [+] Health data records created: {inserted}")
    return inserted
