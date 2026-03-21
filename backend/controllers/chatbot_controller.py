from flask import request, jsonify
import logging
from datetime import datetime
from middleware.firebase_auth import firebase_auth_required, get_current_user, get_current_user_id
from models.chatbot_message import ChatbotMessage
from models.overall_risk_assessment import OverallRiskAssessment

OLLAMA_STREAM_URL = 'https://glycofit-ai.mooo.com/ask/stream'
# Number of previous exchanges to include for context (1 exchange = 1 user + 1 bot message)
HISTORY_CONTEXT_LIMIT = 3


class ChatbotController:
    @staticmethod
    @firebase_auth_required
    def prepare_prompt():
        """
        POST /chatbot/prepare
        Builds the full context-enriched prompt from the user's message,
        chat history, and health profile. Returns it as JSON so the mobile
        client can stream directly to Ollama, bypassing any proxy buffering.

        Request:  { "message": "User's message text" }
        Response: { "success": true, "prompt": "...", "ollama_url": "..." }
        """
        try:
            data = request.get_json()

            if not data or 'message' not in data:
                return jsonify({'success': False, 'error': 'Message is required'}), 400

            user_message = data.get('message', '').strip()
            if not user_message:
                return jsonify({'success': False, 'error': 'Message cannot be empty'}), 400

            user_id = get_current_user_id()

            # Fetch last N exchanges for conversation context
            try:
                recent = ChatbotMessage.get_user_messages(user_id, limit=HISTORY_CONTEXT_LIMIT, skip=0)
                recent = list(reversed(recent))  # chronological order
            except Exception:
                recent = []

            prompt = _build_ollama_prompt(user_message, recent, _build_user_health_context(user_id))

            logging.info(f"Prepared Ollama prompt for user {user_id}")
            return jsonify({
                'success': True,
                'prompt': prompt,
                'ollama_url': OLLAMA_STREAM_URL,
            }), 200

        except Exception as e:
            logging.error(f"Chatbot prepare error: {str(e)}")
            return jsonify({'success': False, 'error': 'Internal server error', 'details': str(e)}), 500

    @staticmethod
    @firebase_auth_required
    def save_message():
        """
        POST /chatbot/save
        Saves a completed user↔bot exchange to the database after the
        mobile client has finished streaming from Ollama.

        Request:  { "user_message": "...", "bot_response": "..." }
        Response: { "success": true }
        """
        try:
            data = request.get_json()
            user_message = (data.get('user_message') or '').strip()
            bot_response = (data.get('bot_response') or '').strip()

            if not user_message or not bot_response:
                return jsonify({'success': False, 'error': 'user_message and bot_response are required'}), 400

            user_id = get_current_user_id()
            ChatbotMessage.create_message(user_id, user_message, bot_response)
            logging.info(f"Saved chatbot exchange for user {user_id}")
            return jsonify({'success': True}), 201

        except Exception as e:
            logging.error(f"Chatbot save error: {str(e)}")
            return jsonify({'success': False, 'error': 'Internal server error', 'details': str(e)}), 500
    
    @staticmethod
    @firebase_auth_required
    def get_history():
        """
        Get paginated chatbot message history for the current user
        
        Query parameters:
            skip: Number of messages to skip (default 0)
            limit: Number of messages to fetch (default 20, max 100)
        
        Returns:
        {
            "success": true,
            "messages": [
                {
                    "_id": "message_id",
                    "user_message": "User's message",
                    "bot_response": "Bot's response",
                    "created_at": "ISO datetime"
                }
            ],
            "total": total_count,
            "skip": skip_value,
            "limit": limit_value
        }
        """
        try:
            user_id = get_current_user_id()
            
            # Get pagination parameters
            skip = request.args.get('skip', 0, type=int)
            limit = request.args.get('limit', 20, type=int)
            
            # Validate and constrain limit
            if limit > 100:
                limit = 100
            if limit < 1:
                limit = 20
            if skip < 0:
                skip = 0
            
            logging.info(f"Fetching chat history for user {user_id}: skip={skip}, limit={limit}")
            
            # Get messages and total count
            messages = ChatbotMessage.get_user_messages(user_id, limit=limit, skip=skip)
            total = ChatbotMessage.get_total_message_count(user_id)
            
            return jsonify({
                'success': True,
                'messages': messages,
                'total': total,
                'skip': skip,
                'limit': limit
            }), 200
            
        except Exception as e:
            logging.error(f"Error fetching chat history: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Failed to fetch chat history',
                'details': str(e)
            }), 500


def _build_ollama_prompt(user_message: str, history: list, health_ctx: dict) -> str:
    """
    Build a plain-text prompt for the Ollama 1B model.
    Keeps the system instruction short and includes the last few exchanges
    so the model has minimal but useful context.

    Args:
        user_message: The new message from the user.
        history: List of previous ChatbotMessage dicts (chronological order, newest last).
                 Each dict has 'user_message' and 'bot_response'.
        health_ctx: Dict returned by _build_user_health_context().
    """
    # --- System instruction (short for small model) ---
    system_lines = [
        "You are GlycoFit's health assistant, helping users manage diabetes risk.",
        "Give concise, practical advice on nutrition, lifestyle, and diabetes prevention.",
        "Never diagnose. Always recommend consulting a doctor for medical decisions.",
    ]

    # Inject health context
    if health_ctx.get('age'):
        system_lines.append(f"User's age: {health_ctx['age']} years old.")
    if health_ctx.get('height_cm') and health_ctx.get('weight_kg'):
        bmi_note = f", BMI {health_ctx['bmi']}" if health_ctx.get('bmi') else ''
        system_lines.append(
            f"User's body metrics: height {health_ctx['height_cm']}cm, weight {health_ctx['weight_kg']}kg{bmi_note}."
        )
    elif health_ctx.get('height_cm'):
        system_lines.append(f"User's height: {health_ctx['height_cm']}cm.")
    elif health_ctx.get('weight_kg'):
        system_lines.append(f"User's weight: {health_ctx['weight_kg']}kg.")
    if health_ctx.get('overall_risk_category'):
        system_lines.append(
            f"User's diabetes risk: {health_ctx['overall_risk_category'].replace('_', ' ').title()}."
        )
    if health_ctx.get('diagnosis_status') and health_ctx['diagnosis_status'] != 'not_diagnosed':
        label = {'prediabetes': 'Prediabetes', 'type2_diabetes': 'Type 2 Diabetes'}.get(
            health_ctx['diagnosis_status'], health_ctx['diagnosis_status']
        )
        system_lines.append(f"User has been diagnosed with: {label}.")
    if health_ctx.get('primary_risk_factors'):
        system_lines.append(
            f"Top risk areas: {', '.join(health_ctx['primary_risk_factors'][:3])}."
        )

    system_block = ' '.join(system_lines)

    # --- Conversation history ---
    history_lines = []
    for exchange in history:
        u = exchange.get('user_message', '').strip()
        b = exchange.get('bot_response', '').strip()
        if u:
            history_lines.append(f"User: {u}")
        if b:
            history_lines.append(f"Assistant: {b}")

    parts = [f"System: {system_block}"]
    if history_lines:
        parts.append('\n'.join(history_lines))
    parts.append(f"User: {user_message}")
    parts.append("Assistant:")

    return '\n'.join(parts)


def _build_user_health_context(user_id: str) -> dict:
    """
    Gather non-sensitive health context for the AI:
    diagnosis status, risk category, lifestyle component scores,
    top risk factors, and personalised recommendations.
    Includes age, height, weight, and BMI as requested by the user.
    Excludes name, email, sex, and other PII.
    Returns an empty dict if data is unavailable so the AI still works.
    """
    ctx = {}
    try:
        # --- User health metrics ---
        user = get_current_user()
        if user:
            ctx['diagnosis_status'] = getattr(user, 'diagnosis_status', 'not_diagnosed')
            if user.age:
                ctx['age'] = user.age
            if user.height:
                ctx['height_cm'] = user.height
            if user.weight:
                ctx['weight_kg'] = user.weight
            if user.height and user.weight and user.height > 0:
                ctx['bmi'] = round(user.weight / ((user.height / 100) ** 2), 1)

        # --- Overall risk assessment ---
        assessment = OverallRiskAssessment.find_by_user_id(user_id)
        if assessment:
            ctx['overall_risk_category'] = assessment.overall_risk_category

            # Lifestyle component scores only — exclude demographic/biometric components
            cs = assessment.component_scores or {}
            lifestyle_components = {
                'initial_assessment': 'Initial Risk Assessment',
                'sleep': 'Sleep',
                'steps': 'Physical Activity',
                'smoking': 'Smoking',
                'alcohol': 'Alcohol',
                'food': 'Diet/Food',
            }
            component_details = {}
            for key, label in lifestyle_components.items():
                info = cs.get(key, {})
                if info.get('has_data'):
                    component_details[label] = {
                        'status': info.get('status') or info.get('risk_level'),
                        'details': info.get('details'),
                    }
            if component_details:
                ctx['component_scores'] = component_details

            # Top risk factors
            if assessment.primary_risk_factors:
                ctx['primary_risk_factors'] = [
                    f.get('component_name', '') for f in assessment.primary_risk_factors[:4]
                    if f.get('component_name')
                ]

            # Personalised recommendations from the assessment
            if assessment.recommendations:
                ctx['recommendations'] = assessment.recommendations[:4]

    except Exception as e:
        logging.warning(f"Could not build health context for user {user_id}: {str(e)}")

    return ctx
