from flask import Blueprint
from controllers.chat_controller import (
    get_or_create_conversation,
    get_conversations,
    get_messages,
    send_message,
    mark_messages_read,
    send_image_message
)
from middleware.firebase_auth import firebase_auth_required

chat_bp = Blueprint('chat', __name__)

# All routes require authentication
@chat_bp.route('/conversation', methods=['POST'])
@firebase_auth_required
def create_conversation_route():
    """Create or get a conversation"""
    return get_or_create_conversation()

@chat_bp.route('/conversations', methods=['GET'])
@firebase_auth_required
def get_conversations_route():
    """Get all conversations for the current user"""
    return get_conversations()

@chat_bp.route('/conversation/<conversation_id>/messages', methods=['GET'])
@firebase_auth_required
def get_messages_route(conversation_id):
    """Get messages for a conversation"""
    return get_messages(conversation_id)

@chat_bp.route('/message', methods=['POST'])
@firebase_auth_required
def send_message_route():
    """Send a message (HTTP fallback)"""
    return send_message()

@chat_bp.route('/message/image', methods=['POST'])
@firebase_auth_required
def send_image_message_route():
    """Send an image message"""
    return send_image_message()

@chat_bp.route('/conversation/<conversation_id>/read', methods=['PUT'])
@firebase_auth_required
def mark_read_route(conversation_id):
    """Mark messages as read"""
    return mark_messages_read(conversation_id)
