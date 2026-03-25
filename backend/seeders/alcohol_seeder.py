"""
Alcohol seeder — alcohol baseline (5 drinking patterns) and daily records
consistent with the baseline profile.
"""

import random

from seeders.helpers import (
    random_seed_datetime, generate_dates_in_range, weighted_choice, SEED_DAYS,
)

# ─── Drinking pattern profiles ──────────────────────────────────────────────────

PATTERNS = ['none', 'occasional', 'weekends', 'regular', 'daily']
PATTERN_WEIGHTS = [0.30, 0.35, 0.20, 0.10, 0.05]

# Valid enum values from the model
VALID_CONTEXTS = ['meal', 'social', 'stress', 'celebration', 'other', 'none']
VALID_TIMES = ['morning', 'afternoon', 'evening', 'night']


def _build_alcohol_profile(age):
    """Generate a consistent alcohol baseline profile."""
    pattern = weighted_choice(PATTERNS, PATTERN_WEIGHTS)

    if pattern == 'none':
        return {
            'pattern': 'none',
            'days_per_week': 0.0,
            'drinks_per_occasion': 0.0,
            'binge_per_month': 0,
            'years': 0,
            'with_meals': False,
            'drink_prob': 0.0,
        }

    cfg = {
        'occasional': {
            'days': (0.5, 1.0), 'drinks': (1.0, 3.0), 'binge': (0, 0),
            'drink_prob': 0.14, 'meal_prob': 0.6,
        },
        'weekends': {
            'days': (1.0, 2.0), 'drinks': (2.0, 5.0), 'binge': (0, 2),
            'drink_prob': 0.28, 'meal_prob': 0.4,
        },
        'regular': {
            'days': (3.0, 5.0), 'drinks': (2.0, 6.0), 'binge': (0, 4),
            'drink_prob': 0.57, 'meal_prob': 0.35,
        },
        'daily': {
            'days': (6.0, 7.0), 'drinks': (3.0, 8.0), 'binge': (1, 6),
            'drink_prob': 0.90, 'meal_prob': 0.3,
        },
    }[pattern]

    # Years at current pattern correlated with age
    max_years = max(1, age - 18)
    years = random.randint(1, min(30, max_years))

    return {
        'pattern': pattern,
        'days_per_week': round(random.uniform(*cfg['days']), 1),
        'drinks_per_occasion': round(random.uniform(*cfg['drinks']), 1),
        'binge_per_month': random.randint(*cfg['binge']),
        'years': years,
        'with_meals': random.random() < cfg['meal_prob'],
        'drink_prob': cfg['drink_prob'],
    }


# ─── Seeders ────────────────────────────────────────────────────────────────────

def seed_alcohol_baseline(db, uid_str, config):
    """Seed a randomized alcohol baseline (uses Firebase UID). Returns profile dict."""
    profile = _build_alcohol_profile(config['age'])
    created = random_seed_datetime()
    doc = {
        'user_id': uid_str,
        'baseline_drinking_days_per_week': profile['days_per_week'],
        'baseline_drinks_per_occasion': profile['drinks_per_occasion'],
        'baseline_binge_frequency_per_month': profile['binge_per_month'],
        'drinking_pattern': profile['pattern'],
        'years_at_current_pattern': profile['years'],
        'drinks_with_meals': profile['with_meals'],
        'created_at': created,
        'updated_at': created,
    }
    result = db.alcohol_baselines.insert_one(doc)
    print(f"  [+] Alcohol baseline created: {result.inserted_id} (pattern: {profile['pattern']})")
    return profile


def seed_alcohol_daily_records(db, uid_str, profile, config, days=None):
    """Seed alcohol daily records consistent with the baseline profile."""
    if days is None:
        days = SEED_DAYS
    days = min(days, SEED_DAYS)

    sex = config['sex']
    binge_threshold = 5.0 if sex == 'male' else 4.0
    drink_prob = profile['drink_prob']
    avg_drinks = profile['drinks_per_occasion']

    inserted = 0
    dates = generate_dates_in_range(days)
    for d in dates:
        if drink_prob > 0 and random.random() < drink_prob:
            # Drinks centered on baseline ± 40%
            drinks = round(random.gauss(avg_drinks, avg_drinks * 0.3), 1)
            drinks = max(0.5, min(20.0, drinks))
            is_binge = drinks >= binge_threshold
            context = weighted_choice(
                ['meal', 'social', 'stress', 'celebration', 'other'],
                [0.30, 0.35, 0.10, 0.10, 0.15],
            )
            time_of_day = weighted_choice(
                VALID_TIMES,
                [0.02, 0.08, 0.55, 0.35],
            )
        else:
            drinks = 0.0
            is_binge = False
            context = 'none'
            time_of_day = 'evening'

        rec_time = random_seed_datetime()
        doc = {
            'user_id': uid_str,
            'date': d,
            'drinks_consumed': drinks,
            'was_binge_episode': is_binge,
            'drinking_context': context,
            'time_of_day': time_of_day,
            'notes': None,
            'created_at': rec_time,
            'updated_at': rec_time,
        }
        db.alcohol_daily_records.insert_one(doc)
        inserted += 1
    print(f"  [+] Alcohol daily records created: {inserted}")
    return inserted
