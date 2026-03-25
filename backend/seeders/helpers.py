"""
Shared constants and utility functions used by all seeder modules.
"""

import os
import json
import random
from datetime import datetime, timedelta

# ─── Seed Configuration ────────────────────────────────────────────────────────

SEED_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/
SEED_TRACKER_FILE = os.path.join(SEED_DIR, '.seeded_users.json')
SEED_USERS_FILE = os.path.join(SEED_DIR, 'seed_users.json')

# All timestamps must be BEFORE March 26 00:00
SEED_DATE_START = datetime(2026, 3, 17)
SEED_DATE_END = datetime(2026, 3, 25, 23, 59, 59)
SEED_DAYS = (SEED_DATE_END.date() - SEED_DATE_START.date()).days + 1  # 9


# ─── Helper Functions ───────────────────────────────────────────────────────────

def save_seed_record(record):
    """Append a seed record to the tracker file."""
    records = []
    if os.path.exists(SEED_TRACKER_FILE):
        with open(SEED_TRACKER_FILE, 'r') as f:
            try:
                records = json.load(f)
            except json.JSONDecodeError:
                records = []
    records.append(record)
    with open(SEED_TRACKER_FILE, 'w') as f:
        json.dump(records, f, indent=2, default=str)


def random_seed_datetime():
    """Return a random datetime within the seed range, restricted to 7 AM – 7 PM."""
    day_offset = random.randint(0, SEED_DAYS - 1)
    day = SEED_DATE_START + timedelta(days=day_offset)
    hour = random.randint(7, 18)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return day.replace(hour=hour, minute=minute, second=second, microsecond=0)


def generate_dates_in_range(n=None):
    """Generate date strings within the seed range, counting backward from SEED_DATE_END."""
    if n is None:
        n = SEED_DAYS
    n = min(n, SEED_DAYS)
    end_date = SEED_DATE_END.date()
    return [(end_date - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(n)]


def random_time(hour_min=21, hour_max=23):
    """Generate a random HH:MM time string."""
    h = random.randint(hour_min, hour_max)
    m = random.randint(0, 59)
    return f"{h:02d}:{m:02d}"


def compute_bmi(height_cm, weight_kg):
    """Compute BMI from height (cm) and weight (kg)."""
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)


def age_to_brfss_category(age):
    """Convert raw age to BRFSS age category (1-13)."""
    if age <= 24: return 1
    elif age <= 29: return 2
    elif age <= 34: return 3
    elif age <= 39: return 4
    elif age <= 44: return 5
    elif age <= 49: return 6
    elif age <= 54: return 7
    elif age <= 59: return 8
    elif age <= 64: return 9
    elif age <= 69: return 10
    elif age <= 74: return 11
    elif age <= 79: return 12
    else: return 13


def sex_to_brfss(sex):
    """Convert sex string to BRFSS numeric (1=male, 0=female)."""
    return 1 if sex == 'male' else 0


def weighted_choice(options, weights):
    """Pick a single item from options using weights."""
    return random.choices(options, weights=weights, k=1)[0]
