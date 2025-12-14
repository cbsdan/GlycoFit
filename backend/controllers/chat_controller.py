from flask import request, jsonify
from flask_socketio import emit, join_room, leave_room
from bson import ObjectId
from datetime import datetime
import logging
import os
import tempfile
import uuid
from werkzeug.utils import secure_filename

from models.chat import ChatMessage, Conversation
from models.patient_physician import PatientPhysician
from models.user import User
from models.physician import Physician
from services.cloudinary_service import CloudinaryService
from services.fcm_service import FCMService

# Module-level socketio instance (set by register_socket_events)
_socketio = None


def get_or_create_conversation():
    """Get or create a conversation between patient and physician"""
    try:
        data = request.json
        # current_user is the User model instance from Firebase auth middleware
        current_user = request.current_user
        
        patient_id = data.get('patient_id')
        physician_id = data.get('physician_id')
        relationship_id = data.get('relationship_id')
        
        if not all([patient_id, physician_id, relationship_id]):
            return jsonify({
                'success': False,
                'message': 'Missing required fields: patient_id, physician_id, relationship_id'
            }), 400
        
        # Verify the relationship exists
        relationship = PatientPhysician.find_by_id(relationship_id)
        if not relationship:
            return jsonify({
                'success': False,
                'message': 'Relationship not found'
            }), 404
        
        # Find or create conversation
        conversation = Conversation.find_or_create(patient_id, physician_id, relationship_id)
        
        return jsonify({
            'success': True,
            'conversation': {
                '_id': str(conversation._id),
                'patient_id': str(conversation.patient_id),
                'physician_id': str(conversation.physician_id),
                'relationship_id': str(conversation.relationship_id),
                'last_message': conversation.last_message,
                'last_message_at': conversation.last_message_at.isoformat() if conversation.last_message_at else None,
                'created_at': conversation.created_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting/creating conversation: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


def get_conversations():
    """Get all conversations for the current user"""
    try:
        # current_user is the User model instance from Firebase auth middleware
        current_user = request.current_user
        firebase_user = request.firebase_user
        user_role = request.args.get('role', 'patient')
        
        # Get user's MongoDB _id
        if user_role == 'physician':
            # Get physician's user_id
            physician = Physician.find_by_firebase_uid(firebase_user.get('uid'))
            if physician:
                user_mongo_id = physician.user_id
            else:
                user_mongo_id = current_user._id
        else:
            user_mongo_id = current_user._id
        
        conversations = Conversation.find_by_user(user_mongo_id, user_role)
        
        # Enrich with user info
        conversation_list = []
        for conv in conversations:
            conv_data = {
                '_id': str(conv._id),
                'patient_id': str(conv.patient_id),
                'physician_id': str(conv.physician_id),
                'relationship_id': str(conv.relationship_id),
                'last_message': conv.last_message,
                'last_message_at': conv.last_message_at.isoformat() if conv.last_message_at else None,
                'unread_count': conv.physician_unread_count if user_role == 'physician' else conv.patient_unread_count,
                'created_at': conv.created_at.isoformat()
            }
            
            # Get the other party's info
            try:
                if user_role == 'physician':
                    other_user = User.find_by_id(conv.patient_id)
                    if other_user:
                        conv_data['other_user'] = {
                            'name': f"{other_user.first_name} {other_user.last_name}",
                            'profile_image': getattr(other_user, 'profile_image', None)
                        }
                else:
                    # Get physician info
                    other_user = User.find_by_id(conv.physician_id)
                    if other_user:
                        physician = Physician.find_by_user_id(conv.physician_id)
                        conv_data['other_user'] = {
                            'name': f"Dr. {other_user.first_name} {other_user.last_name}",
                            'specialty': physician.specialty if physician else None,
                            'profile_image': getattr(other_user, 'profile_image', None)
                        }
            except Exception as e:
                logging.error(f"Error getting other user info: {str(e)}")
                conv_data['other_user'] = {'name': 'Unknown'}
            
            conversation_list.append(conv_data)
        
        return jsonify({
            'success': True,
            'conversations': conversation_list
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting conversations: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


def get_messages(conversation_id):
    """Get messages for a conversation"""
    try:
        current_user = request.current_user
        limit = request.args.get('limit', 50, type=int)
        skip = request.args.get('skip', 0, type=int)
        user_role = request.args.get('role', 'patient')
        
        # Get conversation
        conversation = Conversation.find_by_id(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'message': 'Conversation not found'
            }), 404
        
        # Get messages
        messages = ChatMessage.find_by_conversation(conversation_id, limit, skip)
        
        # Mark messages as read
        count = ChatMessage.mark_as_read(conversation_id, user_role)
        conversation.reset_unread_count(user_role)
        
        # Notify sender via socket that messages were read
        if _socketio and count > 0:
            room = f"conversation_{conversation_id}"
            logging.info(f"📖 Emitting messages_read to room {room}: reader_role={user_role}, count={count}")
            _socketio.emit('messages_read', {
                'conversation_id': conversation_id,
                'reader_role': user_role,
                'read_at': datetime.utcnow().isoformat()
            }, room=room)
        
        message_list = []
        for msg in messages:
            message_list.append({
                '_id': str(msg._id),
                'conversation_id': str(msg.conversation_id),
                'sender_id': str(msg.sender_id),
                'sender_role': msg.sender_role,
                'content': msg.content,
                'message_type': msg.message_type,
                'read': msg.read,
                'read_at': msg.read_at.isoformat() if msg.read_at else None,
                'created_at': msg.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'messages': message_list
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting messages: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


def send_message():
    """Send a message (HTTP fallback for socket.io)"""
    try:
        data = request.json
        current_user = request.current_user
        
        conversation_id = data.get('conversation_id')
        content = data.get('content')
        sender_role = data.get('sender_role', 'patient')
        message_type = data.get('message_type', 'text')
        
        if not all([conversation_id, content]):
            return jsonify({
                'success': False,
                'message': 'Missing required fields: conversation_id, content'
            }), 400
        
        # Get conversation
        conversation = Conversation.find_by_id(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'message': 'Conversation not found'
            }), 404
        
        # current_user is already the User model instance
        sender_id = current_user._id
        
        # Create and save message
        message = ChatMessage(
            conversation_id=ObjectId(conversation_id),
            sender_id=sender_id,
            sender_role=sender_role,
            content=content,
            message_type=message_type
        )
        message.save()
        
        # Update conversation
        conversation.update_last_message(content, sender_role)
        
        message_data = {
            '_id': str(message._id),
            'conversation_id': str(message.conversation_id),
            'sender_id': str(message.sender_id),
            'sender_role': message.sender_role,
            'content': message.content,
            'message_type': message.message_type,
            'read': message.read,
            'created_at': message.created_at.isoformat()
        }
        
        return jsonify({
            'success': True,
            'message': message_data
        }), 201
        
    except Exception as e:
        logging.error(f"Error sending message: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


def mark_messages_read(conversation_id):
    """Mark all messages in a conversation as read"""
    try:
        user_role = request.args.get('role', 'patient')
        
        conversation = Conversation.find_by_id(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'message': 'Conversation not found'
            }), 404
        
        # Mark messages as read
        count = ChatMessage.mark_as_read(conversation_id, user_role)
        conversation.reset_unread_count(user_role)
        
        return jsonify({
            'success': True,
            'marked_count': count
        }), 200
        
    except Exception as e:
        logging.error(f"Error marking messages as read: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


# Socket.IO Event Handlers
def register_socket_events(socketio):
    """Register Socket.IO event handlers"""
    global _socketio
    _socketio = socketio
    
    @socketio.on('connect')
    def handle_connect():
        logging.info(f"Client connected: {request.sid}")
        emit('connected', {'status': 'connected', 'sid': request.sid})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        logging.info(f"Client disconnected: {request.sid}")
    
    @socketio.on('join_conversation')
    def handle_join_conversation(data):
        """Join a conversation room"""
        conversation_id = data.get('conversation_id')
        user_role = data.get('user_role')
        
        if conversation_id:
            room = f"conversation_{conversation_id}"
            join_room(room)
            logging.info(f"User joined room: {room}")
            emit('joined_conversation', {
                'conversation_id': conversation_id,
                'user_role': user_role,
                'room': room
            })
    
    @socketio.on('leave_conversation')
    def handle_leave_conversation(data):
        """Leave a conversation room"""
        conversation_id = data.get('conversation_id')
        
        if conversation_id:
            room = f"conversation_{conversation_id}"
            leave_room(room)
            logging.info(f"User left room: {room}")
            emit('left_conversation', {'conversation_id': conversation_id})
    
    @socketio.on('send_message')
    def handle_send_message(data):
        """Handle incoming message via Socket.IO"""
        try:
            conversation_id = data.get('conversation_id')
            sender_id = data.get('sender_id')
            sender_role = data.get('sender_role')
            content = data.get('content')
            message_type = data.get('message_type', 'text')
            
            if not all([conversation_id, sender_id, content, sender_role]):
                emit('error', {'message': 'Missing required fields'})
                return
            
            # Get conversation
            conversation = Conversation.find_by_id(conversation_id)
            if not conversation:
                emit('error', {'message': 'Conversation not found'})
                return
            
            # Create and save message
            message = ChatMessage(
                conversation_id=ObjectId(conversation_id),
                sender_id=ObjectId(sender_id),
                sender_role=sender_role,
                content=content,
                message_type=message_type
            )
            message.save()
            
            # Update conversation
            conversation.update_last_message(content, sender_role)
            
            message_data = {
                '_id': str(message._id),
                'conversation_id': str(message.conversation_id),
                'sender_id': str(message.sender_id),
                'sender_role': message.sender_role,
                'content': message.content,
                'message_type': message.message_type,
                'read': message.read,
                'created_at': message.created_at.isoformat()
            }
            
            # Broadcast to room
            room = f"conversation_{conversation_id}"
            emit('new_message', message_data, room=room)
            
            logging.info(f"Message sent in conversation {conversation_id}")
            
            # Send push notification to recipient
            try:
                # Determine recipient based on sender role
                if sender_role == 'patient':
                    recipient_id = conversation.physician_id
                    recipient_role = 'physician'
                    # Get sender name from users collection
                    sender = User.find_by_id(sender_id)
                    sender_name = f"{sender.first_name} {sender.last_name}" if sender else "Patient"
                else:
                    recipient_id = conversation.patient_id
                    recipient_role = 'patient'
                    # Get sender name from physicians collection
                    physician = Physician.find_by_user_id(sender_id)
                    if physician:
                        sender_user = User.find_by_id(physician.user_id)
                        sender_name = f"Dr. {sender_user.first_name} {sender_user.last_name}" if sender_user else "Physician"
                    else:
                        sender_name = "Physician"
                
                # Send notification
                result = FCMService.send_chat_notification(
                    recipient_id=recipient_id,
                    sender_name=sender_name,
                    message_content=content if message_type == 'text' else '[Image]',
                    conversation_id=conversation_id,
                    recipient_role=recipient_role
                )
                if result.get('success'):
                    logging.info(f"📲 Push notification sent to {recipient_role} for new message: {result.get('message')}")
                else:
                    logging.warning(f"❌ Failed to send push notification to {recipient_role}: {result.get('error')}")
            except Exception as notif_error:
                logging.error(f"Error sending push notification: {str(notif_error)}")
            
        except Exception as e:
            logging.error(f"Error handling socket message: {str(e)}")
            emit('error', {'message': str(e)})
    
    @socketio.on('typing')
    def handle_typing(data):
        """Handle typing indicator"""
        conversation_id = data.get('conversation_id')
        user_role = data.get('user_role')
        is_typing = data.get('is_typing', True)
        
        if conversation_id:
            room = f"conversation_{conversation_id}"
            emit('user_typing', {
                'conversation_id': conversation_id,
                'user_role': user_role,
                'is_typing': is_typing
            }, room=room, include_self=False)
    
    @socketio.on('mark_read')
    def handle_mark_read(data):
        """Handle marking messages as read via Socket.IO"""
        try:
            conversation_id = data.get('conversation_id')
            reader_role = data.get('reader_role')
            
            logging.info(f"📨 Received mark_read: conversation_id={conversation_id}, reader_role={reader_role}")
            
            if not all([conversation_id, reader_role]):
                logging.warning("Missing conversation_id or reader_role")
                return
            
            # Mark messages as read
            count = ChatMessage.mark_as_read(conversation_id, reader_role)
            logging.info(f"Marked {count} messages as read")
            
            # Reset unread count
            conversation = Conversation.find_by_id(conversation_id)
            if conversation:
                conversation.reset_unread_count(reader_role)
            
            # Notify sender that messages were read
            room = f"conversation_{conversation_id}"
            logging.info(f"📖 Emitting messages_read to room {room}")
            emit('messages_read', {
                'conversation_id': conversation_id,
                'reader_role': reader_role,
                'read_at': datetime.utcnow().isoformat()
            }, room=room)
            
        except Exception as e:
            logging.error(f"Error marking messages as read: {str(e)}")


def send_image_message():
    """Send an image message via HTTP"""
    try:
        current_user = request.current_user
        
        conversation_id = request.form.get('conversation_id')
        sender_role = request.form.get('sender_role', 'patient')
        
        if not conversation_id:
            return jsonify({
                'success': False,
                'message': 'Missing conversation_id'
            }), 400
        
        # Check if conversation exists
        conversation = Conversation.find_by_id(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'message': 'Conversation not found'
            }), 404
        
        # Get image file
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No image file provided'
            }), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No image selected'
            }), 400
        
        # Save temporary file and upload to Cloudinary
        temp_dir = tempfile.gettempdir()
        temp_filename = secure_filename(image_file.filename)
        # Add UUID to avoid conflicts
        temp_filename = f"{uuid.uuid4().hex}_{temp_filename}"
        temp_path = os.path.join(temp_dir, temp_filename)
        image_file.save(temp_path)
        
        try:
            # Upload to Cloudinary
            upload_result = CloudinaryService.upload_image(
                temp_path,
                folder=f"chat/{conversation_id}",
                resource_type='image'
            )
            
            image_url = upload_result.get('secure_url')
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            # Create message with image URL
            message = ChatMessage(
                conversation_id=ObjectId(conversation_id),
                sender_id=current_user._id,
                sender_role=sender_role,
                content=image_url,
                message_type='image'
            )
            message.save()
            
            # Update conversation
            conversation.last_message = f"[{sender_role.capitalize()} sent an image]"
            conversation.last_message_at = datetime.utcnow()
            conversation.save()
            
            # Emit socket event for real-time update if socketio is available
            if _socketio:
                message_data = {
                    '_id': str(message._id),
                    'conversation_id': str(message.conversation_id),
                    'sender_id': str(message.sender_id),
                    'sender_role': message.sender_role,
                    'content': message.content,
                    'message_type': message.message_type,
                    'image_url': image_url,
                    'read': message.read,
                    'created_at': message.created_at.isoformat()
                }
                _socketio.emit('new_message', message_data, room=f"conversation_{conversation_id}")
                
                # Send push notification to recipient
                try:
                    if sender_role == 'patient':
                        recipient_id = conversation.physician_id
                        recipient_role = 'physician'
                        sender = User.find_by_id(current_user._id)
                        sender_name = f"{sender.first_name} {sender.last_name}" if sender else "Patient"
                    else:
                        recipient_id = conversation.patient_id
                        recipient_role = 'patient'
                        physician = Physician.find_by_user_id(current_user._id)
                        if physician:
                            sender_user = User.find_by_id(physician.user_id)
                            sender_name = f"Dr. {sender_user.first_name} {sender_user.last_name}" if sender_user else "Physician"
                        else:
                            sender_name = "Physician"
                    
                    result = FCMService.send_chat_notification(
                        recipient_id=recipient_id,
                        sender_name=sender_name,
                        message_content="Sent an image",
                        conversation_id=conversation_id,
                        recipient_role=recipient_role
                    )
                    if result.get('success'):
                        logging.info(f"📲 Push notification sent for image message: {result.get('message')}")
                    else:
                        logging.warning(f"❌ Failed to send push notification for image: {result.get('error')}")
                except Exception as notif_error:
                    logging.error(f"Error sending push notification for image: {str(notif_error)}")
            
            return jsonify({
                'success': True,
                'message': {
                    '_id': str(message._id),
                    'conversation_id': str(message.conversation_id),
                    'sender_id': str(message.sender_id),
                    'sender_role': message.sender_role,
                    'content': message.content,
                    'message_type': message.message_type,
                    'image_url': image_url,
                    'read': message.read,
                    'created_at': message.created_at.isoformat()
                }
            }), 200
            
        except Exception as upload_error:
            logging.error(f"Error uploading image to Cloudinary: {str(upload_error)}")
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({
                'success': False,
                'message': f'Error uploading image: {str(upload_error)}'
            }), 500
        
    except Exception as e:
        logging.error(f"Error sending image message: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
