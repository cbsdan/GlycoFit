from flask import request, jsonify
import logging
from datetime import datetime
from services.groq_service import get_groq_service
from middleware.firebase_auth import firebase_auth_required, get_current_user_id
from models.chatbot_message import ChatbotMessage

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
                response_text = groq_service.generate_health_response(user_message, user_id)
                
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
