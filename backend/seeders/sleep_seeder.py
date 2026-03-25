"""
Sleep seeder — sleep baseline and daily records with randomized values
centered around each user's baseline.
"""

import random

from seeders.helpers import (
    random_seed_datetime, generate_dates_in_range, random_time,
    weighted_choice, SEED_DAYS,
)


def _random_usual_bedtime():
    """Generate a realistic usual bedtime between 20:00 and 01:00."""
    # Hours 20–23 and 0–1 mapped as weights
    hour = weighted_choice(
        [20, 21, 22, 23, 0, 1],
        [0.05, 0.20, 0.35, 0.25, 0.10, 0.05],
    )
    minute = random.choice([0, 15, 30, 45])
    return f"{hour:02d}:{minute:02d}", hour, minute


def _wake_time_from(bed_hour, bed_minute, sleep_hours):
    """Derive wake time string from bedtime and sleep duration."""
    total_min = bed_hour * 60 + bed_minute + int(sleep_hours * 60)
    total_min %= 24 * 60
    return f"{total_min // 60:02d}:{total_min % 60:02d}"


def seed_sleep_baseline(db, uid_str):
    """Seed a randomized sleep baseline (uses MongoDB ObjectId string)."""
    avg_hours = round(random.uniform(5.0, 9.0), 1)

    # Nights with 6h+ correlated with avg_hours
    if avg_hours >= 7.0:
        nights_6h = random.randint(5, 7)
    elif avg_hours >= 6.0:
        nights_6h = random.randint(3, 6)
    else:
        nights_6h = random.randint(1, 4)

    bedtime_str, bed_h, bed_m = _random_usual_bedtime()
    wake_str = _wake_time_from(bed_h, bed_m, avg_hours)

    doc = {
        'user_id': uid_str,
        'baseline_avg_sleep_hours': avg_hours,
        'baseline_nights_6h_plus_per_week': nights_6h,
        'baseline_bedtime_consistency': random.randint(1, 5),
        'usual_bedtime': bedtime_str,
        'usual_wake_time': wake_str,
        'created_at': random_seed_datetime(),
        'is_locked': True,
    }
    result = db.sleep_baselines.insert_one(doc)
    print(f"  [+] Sleep baseline created: {result.inserted_id} (avg {avg_hours}h, bed {bedtime_str})")
    return doc  # return full doc so daily records can use it


def seed_sleep_daily_records(db, uid_str, baseline_doc, days=None):
    """Seed sleep daily records with values centered around the baseline."""
    if days is None:
        days = SEED_DAYS
    days = min(days, SEED_DAYS)

    avg_hours = baseline_doc['baseline_avg_sleep_hours']
    bed_str = baseline_doc['usual_bedtime']
    bed_h, bed_m = map(int, bed_str.split(':'))

    inserted = 0
    dates = generate_dates_in_range(days)
    for d in dates:
        # Duration centered on baseline ± 1.5h, clamped 3–12
        duration = round(random.gauss(avg_hours, 0.75), 1)
        duration = max(3.0, min(12.0, duration))

        # Bedtime jitter ± 90 min around usual
        jitter = random.randint(-90, 90)
        actual_bed_total = (bed_h * 60 + bed_m + jitter) % (24 * 60)
        actual_bed_h = actual_bed_total // 60
        actual_bed_m = actual_bed_total % 60
        bedtime = f"{actual_bed_h:02d}:{actual_bed_m:02d}"
        wake_time = _wake_time_from(actual_bed_h, actual_bed_m, duration)

        # Quality correlated with duration
        if duration >= 7.5:
            quality = weighted_choice([3, 4, 5], [0.15, 0.45, 0.40])
        elif duration >= 6.0:
            quality = weighted_choice([2, 3, 4, 5], [0.10, 0.35, 0.40, 0.15])
        else:
            quality = weighted_choice([1, 2, 3, 4], [0.20, 0.40, 0.30, 0.10])

        rec_time = random_seed_datetime()
        doc = {
            'user_id': uid_str,
            'date': d,
            'bedtime': bedtime,
            'sleep_duration_hours': duration,
            'source': 'manual',
            'wake_time': wake_time,
            'sleep_quality': quality,
            'notes': None,
            'created_at': rec_time,
            'updated_at': rec_time,
        }
        db.sleep_daily_records.insert_one(doc)
        inserted += 1
    print(f"  [+] Sleep daily records created: {inserted}")
    return inserted
