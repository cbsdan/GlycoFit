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
