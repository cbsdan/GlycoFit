from flask import Blueprint, jsonify, request
from controllers.chatbot_controller import ChatbotController

chatbot_bp = Blueprint('chatbot', __name__)

@chatbot_bp.route('/message', methods=['POST'])
def send_message():
    """
    POST /api/v1/chatbot/message
    
    Send a message to the chatbot and get AI-powered response
    
    Request:
    {
        "message": "What should I eat for breakfast?"
    }
    
    Response:
    {
        "success": true,
        "response": "Based on your health profile, I recommend...",
        "timestamp": "2025-12-17T10:30:00Z"
    }
    """
    return ChatbotController.send_message()
@chatbot_bp.route('/history', methods=['GET'])
def get_history():
    """
    GET /api/v1/chatbot/history?skip=0&limit=20
    
    Get paginated chatbot message history for the current user
    
    Query parameters:
        skip: Number of messages to skip (default 0)
        limit: Number of messages to fetch (default 20, max 100)
    
    Response:
    {
        "success": true,
        "messages": [
            {
                "_id": "message_id",
                "user_message": "User's message",
                "bot_response": "Bot's response",
                "created_at": "2025-12-17T10:30:00"
            }
        ],
        "total": 150,
        "skip": 0,
        "limit": 20
    }
    """
    return ChatbotController.get_history()