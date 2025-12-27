from flask import request, jsonify
import logging
from datetime import datetime
from services.gemini_service import get_gemini_service
from middleware.firebase_auth import firebase_auth_required, get_current_user_id

class ChatbotController:
    @staticmethod
    @firebase_auth_required
    def send_message():
        """
        Handle chatbot conversation using Gemini AI
        
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
            
            # Get Gemini service
            gemini_service = get_gemini_service()
            
            if not gemini_service or not gemini_service.is_ready():
                logging.error("Gemini service not available")
                return jsonify({
                    'success': False,
                    'error': 'AI service is temporarily unavailable'
                }), 503
            
            # Generate response using Gemini
            try:
                logging.info(f"Processing chatbot message for user: {user_id}")
                response_text = gemini_service.generate_health_response(user_message, user_id)
                
                return jsonify({
                    'success': True,
                    'response': response_text,
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }), 200
                
            except Exception as ai_error:
                logging.error(f"Gemini AI error: {str(ai_error)}")
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
