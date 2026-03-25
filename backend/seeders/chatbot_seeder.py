"""
Chatbot seeder — seed chatbot conversation messages.
Each user gets a random subset (2-5) of conversation pairs.
"""

import random

from seeders.helpers import random_seed_datetime

# Expanded conversation pool
_CONVERSATIONS = [
    (
        "What foods should I avoid with prediabetes?",
        "Focus on reducing refined carbohydrates, sugary drinks, and processed foods. Instead, choose whole grains, lean proteins, and plenty of vegetables."
    ),
    (
        "How many steps should I aim for daily?",
        "For diabetes prevention, aim for at least 7,000-10,000 steps per day. Even 30 minutes of brisk walking can make a significant difference."
    ),
    (
        "Is my sleep affecting my blood sugar?",
        "Yes, poor sleep quality and short sleep duration are linked to insulin resistance. Aim for 7-8 hours of quality sleep per night."
    ),
    (
        "What is a normal fasting blood sugar?",
        "A normal fasting blood sugar level is below 100 mg/dL. Between 100-125 mg/dL indicates prediabetes, and 126 mg/dL or higher indicates diabetes."
    ),
    (
        "Can exercise help with prediabetes?",
        "Absolutely! Regular physical activity improves insulin sensitivity. Aim for at least 150 minutes of moderate-intensity exercise per week."
    ),
    (
        "Is rice bad for diabetes?",
        "White rice has a high glycemic index and can spike blood sugar. Try switching to brown rice, cauliflower rice, or reducing portions while adding more vegetables to your meals."
    ),
    (
        "How does stress affect blood sugar?",
        "Stress hormones like cortisol can raise blood sugar levels. Managing stress through exercise, meditation, or breathing techniques can help with glucose control."
    ),
    (
        "What are good Filipino foods for diabetics?",
        "Try sinigang (tamarind soup), pinakbet (mixed vegetables), and grilled fish. Avoid lechon and fried foods. Use brown rice instead of white rice."
    ),
    (
        "How often should I check my blood sugar?",
        "If you have prediabetes, checking fasting blood sugar once a week is a good start. Your doctor may recommend more frequent monitoring depending on your situation."
    ),
    (
        "Does drinking water help with blood sugar?",
        "Yes, staying hydrated helps your kidneys flush out excess sugar. Aim for at least 8 glasses of water a day and avoid sugary beverages."
    ),
]


def seed_chatbot_messages(db, user_object_id, count=None):
    """Seed a random subset of chatbot conversation messages."""
    if count is None:
        count = random.randint(2, 5)
    count = min(count, len(_CONVERSATIONS))
    selected = random.sample(_CONVERSATIONS, k=count)

    inserted = 0
    for user_msg, bot_resp in selected:
        rec_time = random_seed_datetime()
        doc = {
            'user_id': user_object_id,
            'user_message': user_msg,
            'bot_response': bot_resp,
            'created_at': rec_time,
            'updated_at': rec_time,
        }
        db.chatbot_messages.insert_one(doc)
        inserted += 1
    print(f"  [+] Chatbot messages created: {inserted}")
    return inserted
