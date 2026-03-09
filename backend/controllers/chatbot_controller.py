from flask import request, jsonify
import logging
from datetime import datetime
from services.groq_service import get_groq_service
from middleware.firebase_auth import firebase_auth_required, get_current_user, get_current_user_id
from models.chatbot_message import ChatbotMessage
from models.overall_risk_assessment import OverallRiskAssessment

class ChatbotController:
    @staticmethod
    @firebase_auth_required
    def send_message():
        """
        Handle chatbot conversation using Groq AI
        
        Expected request:
        {
            "message": "User's message text"
        }
        
        Returns:
        {
            "success": true,
            "response": "AI response text",
            "timestamp": "ISO datetime"
        }
        """
        try:
            # Get request data
            data = request.get_json()
            
            if not data or 'message' not in data:
                return jsonify({
                    'success': False,
                    'error': 'Message is required'
                }), 400
            
            user_message = data.get('message', '').strip()
            
            if not user_message:
                return jsonify({
                    'success': False,
                    'error': 'Message cannot be empty'
                }), 400
            
            # Get user ID for personalized responses
            user_id = get_current_user_id()

            # Build health context for personalized AI responses
            user_health_context = _build_user_health_context(user_id)

            # Get Groq service
            groq_service = get_groq_service()
            
            if not groq_service or not groq_service.is_ready():
                logging.error("Groq service not available")
                return jsonify({
                    'success': False,
                    'error': 'AI service is temporarily unavailable'
                }), 503
            
            # Generate response using Groq
            try:
                logging.info(f"Processing chatbot message for user: {user_id}")
                response_text = groq_service.generate_health_response(user_message, user_id, user_health_context)
                
                # Save message to database
                try:
                    ChatbotMessage.create_message(user_id, user_message, response_text)
                except Exception as db_error:
                    logging.error(f"Failed to save chatbot message: {str(db_error)}")
                    # Don't fail the response if database save fails, just log it
                
                return jsonify({
                    'success': True,
                    'response': response_text,
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }), 200
                
            except Exception as ai_error:
                logging.error(f"Groq AI error: {str(ai_error)}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to generate response',
                    'details': str(ai_error)
                }), 500
                
        except Exception as e:
            logging.error(f"Chatbot controller error: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error',
                'details': str(e)
            }), 500
    
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


def _build_user_health_context(user_id: str) -> dict:
    """
    Gather non-sensitive health context for the AI:
    diagnosis status, risk category, lifestyle component scores,
    top risk factors, and personalised recommendations.
    Deliberately excludes personally identifiable or sensitive data
    (name, age, sex, height, weight, raw BMI value).
    Returns an empty dict if data is unavailable so the AI still works.
    """
    ctx = {}
    try:
        # --- Diagnosis status only (no PII) ---
        user = get_current_user()
        if user:
            ctx['diagnosis_status'] = getattr(user, 'diagnosis_status', 'not_diagnosed')

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
