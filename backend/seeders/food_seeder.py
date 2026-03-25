"""
Food seeder — food baseline assessment (16 randomized questions) and daily meal records.
All option strings are exact matches to FoodBaselineAssessment.BASELINE_QUESTIONS.
"""

import random
from datetime import timedelta

from seeders.helpers import (
    random_seed_datetime, weighted_choice, SEED_DATE_END, SEED_DAYS,
)

# ─── Exact option strings from models/food_baseline_assessment.py ───────────────

FREQ_SCALE_WITH_ALWAYS = [
    'Never',
    'Rarely (1-2 times/week)',
    'Sometimes (3-4 times/week)',
    'Often (5-6 times/week)',
    'Always (daily)',
]

FREQ_SCALE_WITH_DAILY = [
    'Never',
    'Rarely (1-2 times/week)',
    'Sometimes (3-4 times/week)',
    'Often (5-6 times/week)',
    'Daily',
]

SHORT_FREQ_SCALE = ['Never', 'Rarely', 'Sometimes', 'Often', 'Daily']

PORTION_SCALE = ['Small', 'Moderate', 'Large', 'Very Large', 'Unsure']

SPEED_SCALE = ['Very Slow', 'Slow', 'Moderate', 'Fast', 'Very Fast']

# Weighted distributions for each scale (realistic Filipino adult population)
W_FREQ_ALWAYS = [0.10, 0.25, 0.35, 0.20, 0.10]  # skip_breakfast, late_night_eating
W_FREQ_DAILY = [0.12, 0.30, 0.30, 0.18, 0.10]    # sugary_drinks, processed_food, red_meat, fried_food
W_SHORT_FREQ_HEALTHY = [0.08, 0.18, 0.35, 0.25, 0.14]  # whole_grains, fiber_rich (protective)
W_SHORT_FREQ_UNHEALTHY = [0.10, 0.20, 0.35, 0.25, 0.10]  # refined_carbs
W_PORTION = [0.10, 0.45, 0.30, 0.10, 0.05]
W_SPEED = [0.05, 0.15, 0.45, 0.25, 0.10]


def _random_food_responses():
    """Generate a randomized food baseline 'responses' dict."""
    return {
        'daily_meal_frequency': weighted_choice([2, 3, 4], [0.15, 0.65, 0.20]),
        'skip_breakfast': weighted_choice(FREQ_SCALE_WITH_ALWAYS, W_FREQ_ALWAYS),
        'late_night_eating': weighted_choice(FREQ_SCALE_WITH_ALWAYS, W_FREQ_ALWAYS),
        'sugary_drinks_frequency': weighted_choice(FREQ_SCALE_WITH_DAILY, W_FREQ_DAILY),
        'processed_food_frequency': weighted_choice(FREQ_SCALE_WITH_DAILY, W_FREQ_DAILY),
        'whole_grains_intake': weighted_choice(SHORT_FREQ_SCALE, W_SHORT_FREQ_HEALTHY),
        'vegetable_servings': weighted_choice([1, 2, 3, 4, 5], [0.10, 0.30, 0.35, 0.18, 0.07]),
        'fruit_servings': weighted_choice([0, 1, 2, 3, 4], [0.10, 0.30, 0.35, 0.18, 0.07]),
        'red_meat_frequency': weighted_choice(FREQ_SCALE_WITH_DAILY, W_FREQ_DAILY),
        'fried_food_frequency': weighted_choice(FREQ_SCALE_WITH_DAILY, W_FREQ_DAILY),
        'snacking_frequency': weighted_choice([0, 1, 2, 3, 4], [0.08, 0.25, 0.35, 0.22, 0.10]),
        'portion_size_awareness': weighted_choice(PORTION_SCALE, W_PORTION),
        'fiber_rich_foods': weighted_choice(SHORT_FREQ_SCALE, W_SHORT_FREQ_HEALTHY),
        'refined_carbs_frequency': weighted_choice(SHORT_FREQ_SCALE, W_SHORT_FREQ_UNHEALTHY),
        'water_intake': random.randint(3, 10),
        'eating_speed': weighted_choice(SPEED_SCALE, W_SPEED),
    }


def seed_food_baseline(db, user_object_id):
    """Seed a randomized food baseline assessment and compute the risk score."""
    from models.food_baseline_assessment import FoodBaselineAssessment
    created = random_seed_datetime()
    doc = {
        'user_id': user_object_id,
        'responses': _random_food_responses(),
        'baseline_risk_score': 0,
        'created_at': created,
        'updated_at': created,
        'last_calculated': None,
    }
    result = db.food_baseline_assessments.insert_one(doc)
    # Trigger score calculation so baseline_risk_score is not left at 0
    calc = FoodBaselineAssessment.update_baseline_risk_score(str(user_object_id))
    score = calc.get('baseline_risk_score', 0) if calc.get('success') else 0
    print(f"  [+] Food baseline assessment created: {result.inserted_id} (risk score: {score:.1f})")
    return result.inserted_id


# ─── Meal Templates ─────────────────────────────────────────────────────────────
# Filipino / Tagalog dishes for all meal types.

_MEAL_TEMPLATES = {
    'breakfast': [
        {'name': 'Tapsilog (Tapa, Sinangag, Itlog)', 'calories': 580, 'protein': 28, 'carbs': 60, 'fat': 24, 'sugar': 4, 'fiber': 1, 'sat_fat': 9, 'unsat_fat': 12, 'sodium': 750, 'gl': 22},
        {'name': 'Longsilog (Longganisa, Sinangag, Itlog)', 'calories': 620, 'protein': 24, 'carbs': 62, 'fat': 28, 'sugar': 6, 'fiber': 1, 'sat_fat': 10, 'unsat_fat': 14, 'sodium': 820, 'gl': 23},
        {'name': 'Tocilog (Tocino, Sinangag, Itlog)', 'calories': 590, 'protein': 25, 'carbs': 64, 'fat': 22, 'sugar': 14, 'fiber': 1, 'sat_fat': 8, 'unsat_fat': 11, 'sodium': 700, 'gl': 24},
        {'name': 'Champorado (Tsocolateng Kanin)', 'calories': 350, 'protein': 6, 'carbs': 68, 'fat': 6, 'sugar': 28, 'fiber': 3, 'sat_fat': 3, 'unsat_fat': 2, 'sodium': 90, 'gl': 24},
        {'name': 'Pandesal at Keso', 'calories': 300, 'protein': 10, 'carbs': 44, 'fat': 10, 'sugar': 6, 'fiber': 2, 'sat_fat': 5, 'unsat_fat': 4, 'sodium': 400, 'gl': 17},
        {'name': 'Lugaw na may Itlog at Toyo', 'calories': 290, 'protein': 12, 'carbs': 46, 'fat': 5, 'sugar': 2, 'fiber': 1, 'sat_fat': 1.5, 'unsat_fat': 2.5, 'sodium': 720, 'gl': 19},
    ],
    'lunch': [
        {'name': 'Adobong Manok at Kanin', 'calories': 550, 'protein': 32, 'carbs': 58, 'fat': 18, 'sugar': 6, 'fiber': 2, 'sat_fat': 5, 'unsat_fat': 11, 'sodium': 920, 'gl': 20},
        {'name': 'Sinigang na Baboy at Kanin', 'calories': 480, 'protein': 25, 'carbs': 52, 'fat': 16, 'sugar': 5, 'fiber': 4, 'sat_fat': 5, 'unsat_fat': 9, 'sodium': 850, 'gl': 16},
        {'name': 'Lechon Kawali at Kanin', 'calories': 650, 'protein': 30, 'carbs': 55, 'fat': 32, 'sugar': 3, 'fiber': 1, 'sat_fat': 12, 'unsat_fat': 17, 'sodium': 780, 'gl': 20},
        {'name': 'Pinakbet at Kanin', 'calories': 390, 'protein': 15, 'carbs': 55, 'fat': 12, 'sugar': 8, 'fiber': 7, 'sat_fat': 3, 'unsat_fat': 7, 'sodium': 680, 'gl': 14},
        {'name': 'Bulalo at Kanin', 'calories': 620, 'protein': 38, 'carbs': 54, 'fat': 26, 'sugar': 3, 'fiber': 2, 'sat_fat': 11, 'unsat_fat': 13, 'sodium': 680, 'gl': 19},
        {'name': 'Pancit Canton na may Gulay', 'calories': 420, 'protein': 18, 'carbs': 58, 'fat': 14, 'sugar': 5, 'fiber': 3, 'sat_fat': 3, 'unsat_fat': 9, 'sodium': 780, 'gl': 19},
    ],
    'dinner': [
        {'name': 'Tinolang Manok sa Kanin', 'calories': 420, 'protein': 28, 'carbs': 48, 'fat': 10, 'sugar': 4, 'fiber': 3, 'sat_fat': 3, 'unsat_fat': 6, 'sodium': 650, 'gl': 15},
        {'name': 'Bistek Tagalog sa Kanin', 'calories': 530, 'protein': 32, 'carbs': 54, 'fat': 18, 'sugar': 7, 'fiber': 2, 'sat_fat': 6, 'unsat_fat': 10, 'sodium': 880, 'gl': 19},
        {'name': 'Pork Menudo sa Kanin', 'calories': 510, 'protein': 28, 'carbs': 56, 'fat': 20, 'sugar': 8, 'fiber': 4, 'sat_fat': 7, 'unsat_fat': 11, 'sodium': 760, 'gl': 18},
        {'name': 'Ginisang Monggo sa Kanin', 'calories': 380, 'protein': 18, 'carbs': 58, 'fat': 8, 'sugar': 4, 'fiber': 9, 'sat_fat': 2, 'unsat_fat': 5, 'sodium': 620, 'gl': 14},
        {'name': 'Laing (Gabi sa Gata) sa Kanin', 'calories': 460, 'protein': 16, 'carbs': 55, 'fat': 20, 'sugar': 5, 'fiber': 6, 'sat_fat': 14, 'unsat_fat': 4, 'sodium': 520, 'gl': 16},
        {'name': 'Nilaga na Baka sa Kanin', 'calories': 450, 'protein': 30, 'carbs': 50, 'fat': 14, 'sugar': 5, 'fiber': 4, 'sat_fat': 5, 'unsat_fat': 7, 'sodium': 700, 'gl': 16},
    ],
    'snacks': [
        {'name': 'Banana Cue (Pritong Saging na Saba)', 'calories': 280, 'protein': 2, 'carbs': 52, 'fat': 9, 'sugar': 30, 'fiber': 3, 'sat_fat': 4, 'unsat_fat': 4, 'sodium': 20, 'gl': 18},
        {'name': 'Turon (Lumpiang Saging)', 'calories': 260, 'protein': 3, 'carbs': 45, 'fat': 9, 'sugar': 22, 'fiber': 2, 'sat_fat': 3, 'unsat_fat': 5, 'sodium': 60, 'gl': 16},
        {'name': 'Kamote Cue (Pritong Kamote)', 'calories': 240, 'protein': 2, 'carbs': 48, 'fat': 7, 'sugar': 20, 'fiber': 3, 'sat_fat': 3, 'unsat_fat': 3, 'sodium': 15, 'gl': 15},
        {'name': 'Puto (Bigas na Puto)', 'calories': 200, 'protein': 4, 'carbs': 40, 'fat': 3, 'sugar': 12, 'fiber': 1, 'sat_fat': 1.5, 'unsat_fat': 1, 'sodium': 180, 'gl': 17},
        {'name': 'Bibingka (Bibingkang Galapong)', 'calories': 310, 'protein': 6, 'carbs': 52, 'fat': 10, 'sugar': 20, 'fiber': 1, 'sat_fat': 6, 'unsat_fat': 3, 'sodium': 200, 'gl': 20},
        {'name': 'Sago at Gulaman (Inuming Malamig)', 'calories': 190, 'protein': 1, 'carbs': 46, 'fat': 0.5, 'sugar': 35, 'fiber': 1, 'sat_fat': 0, 'unsat_fat': 0.3, 'sodium': 30, 'gl': 20},
    ],
}

MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks']
MEAL_HOURS = {'breakfast': 7, 'lunch': 12, 'dinner': 19, 'snacks': 15}


def seed_user_meals(db, user_object_id, days=None):
    """Seed randomized user meal records within the seed date range."""
    if days is None:
        days = SEED_DAYS
    days = min(days, SEED_DAYS)

    inserted = 0
    end_date = SEED_DATE_END
    for day_offset in range(days):
        day = end_date - timedelta(days=day_offset)
        # 2-4 meals per day
        day_meals = random.sample(MEAL_TYPES, k=random.randint(2, 4))
        for mt in day_meals:
            # Pick a random template for this meal type
            t = random.choice(_MEAL_TEMPLATES[mt])
            factor = random.uniform(0.80, 1.20)
            meal_hour = MEAL_HOURS[mt]
            meal_dt = day.replace(
                hour=meal_hour, minute=random.randint(0, 59),
                second=0, microsecond=0,
            )
            doc = {
                'user_id': user_object_id,
                'nutrients': {
                    'Calories': round(t['calories'] * factor, 1),
                    'Protein (g)': round(t['protein'] * factor, 1),
                    'Carbs (g)': round(t['carbs'] * factor, 1),
                    'Fat (g)': round(t['fat'] * factor, 1),
                    'Added Sugars (g)': round(t['sugar'] * factor, 1),
                    'Fiber (g)': round(t['fiber'] * factor, 1),
                    'Saturated Fat (g)': round(t['sat_fat'] * factor, 1),
                    'Unsaturated Fat (g)': round(t['unsat_fat'] * factor, 1),
                    'Sodium (mg)': round(t['sodium'] * factor, 1),
                    'Glycemic Load': round(t['gl'] * factor, 1),
                },
                'image_url': None,
                'image_public_id': None,
                'meal_name': t['name'],
                'notes': None,
                'food_type': mt,
                'serving_size': '1 serving',
                'confidence_rate': random.randint(70, 95),
                'confidence_explanation': 'Auto-generated seed data.',
                'health_assessment': None,
                'recipes': [],
                'ingredient_nutrients': [],
                'ingredient_proportions': {},
                'meal_datetime': meal_dt,
                'created_at': meal_dt,
                'updated_at': meal_dt,
            }
            db.user_meals.insert_one(doc)
            inserted += 1
    print(f"  [+] User meals created: {inserted} records over {days} days")
    return inserted
