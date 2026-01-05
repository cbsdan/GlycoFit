from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class ChatMessage:
    """Model for chat messages between patients and physicians"""
    
    def __init__(self, conversation_id, sender_id, sender_role, content, message_type='text'):
        self.conversation_id = conversation_id  # Reference to conversation
        self.sender_id = sender_id  # User._id of sender
        self.sender_role = sender_role  # 'patient' or 'physician'
        self.content = content
        self.message_type = message_type  # text, image, file
        self.read = False
        self.read_at = None
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert message to dictionary for MongoDB storage"""
        return {
            'conversation_id': self.conversation_id,
            'sender_id': self.sender_id,
            'sender_role': self.sender_role,
            'content': self.content,
            'message_type': self.message_type,
            'read': self.read,
            'read_at': self.read_at,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create ChatMessage object from MongoDB document"""
        message = cls(
            conversation_id=data['conversation_id'],
            sender_id=data['sender_id'],
            sender_role=data['sender_role'],
            content=data['content'],
            message_type=data.get('message_type', 'text')
        )
        message.read = data.get('read', False)
        message.read_at = data.get('read_at')
        message.created_at = data.get('created_at', datetime.utcnow())
        message.updated_at = data.get('updated_at', datetime.utcnow())
        return message

    def save(self):
        """Save message to database"""
        try:
            db = get_db()
            message_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.chat_messages.update_one(
                    {'_id': self._id},
                    {'$set': message_data}
                )
                log_database_operation('update_one', 'chat_messages', {'_id': self._id}, result)
                return result
            else:
                result = db.chat_messages.insert_one(message_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'chat_messages', message_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving chat message: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(message_id):
        """Find message by ID"""
        try:
            db = get_db()
            data = db.chat_messages.find_one({'_id': ObjectId(message_id)})
            log_database_operation('find_one', 'chat_messages', {'_id': message_id}, data)

            if data:
                message = ChatMessage.from_dict(data)
                message._id = data['_id']
                return message
            return None

        except Exception as e:
            logging.error(f"Error finding message by ID: {str(e)}")
            raise e

    @staticmethod
    def find_by_conversation(conversation_id, limit=50, skip=0):
        """Find all messages in a conversation"""
        try:
            db = get_db()
            if isinstance(conversation_id, str):
                conversation_id = ObjectId(conversation_id)
            
            cursor = db.chat_messages.find(
                {'conversation_id': conversation_id}
            ).sort('created_at', 1).skip(skip).limit(limit)
            
            messages = []
            for data in cursor:
                message = ChatMessage.from_dict(data)
                message._id = data['_id']
                messages.append(message)
            
            log_database_operation('find', 'chat_messages', {'conversation_id': conversation_id}, f"Found {len(messages)} messages")
            return messages

        except Exception as e:
            logging.error(f"Error finding messages by conversation: {str(e)}")
            raise e

    @staticmethod
    def mark_as_read(conversation_id, reader_role):
        """Mark all messages from the other party as read"""
        try:
            db = get_db()
            if isinstance(conversation_id, str):
                conversation_id = ObjectId(conversation_id)
            
            # Mark messages from the other role as read
            other_role = 'patient' if reader_role == 'physician' else 'physician'
            
            result = db.chat_messages.update_many(
                {
                    'conversation_id': conversation_id,
                    'sender_role': other_role,
                    'read': False
                },
                {
                    '$set': {
                        'read': True,
                        'read_at': datetime.utcnow()
                    }
                }
            )
            
            log_database_operation('update_many', 'chat_messages', {'conversation_id': conversation_id}, result)
            return result.modified_count

        except Exception as e:
            logging.error(f"Error marking messages as read: {str(e)}")
            raise e

    @staticmethod
    def get_unread_count(conversation_id, reader_role):
        """Get count of unread messages for a user"""
        try:
            db = get_db()
            if isinstance(conversation_id, str):
                conversation_id = ObjectId(conversation_id)
            
            other_role = 'patient' if reader_role == 'physician' else 'physician'
            
            count = db.chat_messages.count_documents({
                'conversation_id': conversation_id,
                'sender_role': other_role,
                'read': False
            })
            
            return count

        except Exception as e:
            logging.error(f"Error getting unread count: {str(e)}")
            return 0


class Conversation:
    """Model for conversations between patients and physicians"""
    
    def __init__(self, patient_id, physician_id, relationship_id):
        self.patient_id = patient_id  # User._id of patient
        self.physician_id = physician_id  # User._id of physician (not Physician._id)
        self.relationship_id = relationship_id  # PatientPhysician._id
        self.last_message = None
        self.last_message_at = None
        self.patient_unread_count = 0
        self.physician_unread_count = 0
        self.is_active = True
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert conversation to dictionary for MongoDB storage"""
        return {
            'patient_id': self.patient_id,
            'physician_id': self.physician_id,
            'relationship_id': self.relationship_id,
            'last_message': self.last_message,
            'last_message_at': self.last_message_at,
            'patient_unread_count': self.patient_unread_count,
            'physician_unread_count': self.physician_unread_count,
            'is_active': self.is_active,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create Conversation object from MongoDB document"""
        conversation = cls(
            patient_id=data['patient_id'],
            physician_id=data['physician_id'],
            relationship_id=data['relationship_id']
        )
        conversation.last_message = data.get('last_message')
        conversation.last_message_at = data.get('last_message_at')
        conversation.patient_unread_count = data.get('patient_unread_count', 0)
        conversation.physician_unread_count = data.get('physician_unread_count', 0)
        conversation.is_active = data.get('is_active', True)
        conversation.created_at = data.get('created_at', datetime.utcnow())
        conversation.updated_at = data.get('updated_at', datetime.utcnow())
        return conversation

    def save(self):
        """Save conversation to database"""
        try:
            db = get_db()
            conversation_data = self.to_dict()

            if hasattr(self, '_id'):
                result = db.conversations.update_one(
                    {'_id': self._id},
                    {'$set': conversation_data}
                )
                log_database_operation('update_one', 'conversations', {'_id': self._id}, result)
                return result
            else:
                result = db.conversations.insert_one(conversation_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'conversations', conversation_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving conversation: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(conversation_id):
        """Find conversation by ID"""
        try:
            db = get_db()
            data = db.conversations.find_one({'_id': ObjectId(conversation_id)})
            log_database_operation('find_one', 'conversations', {'_id': conversation_id}, data)

            if data:
                conversation = Conversation.from_dict(data)
                conversation._id = data['_id']
                return conversation
            return None

        except Exception as e:
            logging.error(f"Error finding conversation by ID: {str(e)}")
            raise e

    @staticmethod
    def find_by_relationship(relationship_id):
        """Find conversation by relationship ID"""
        try:
            db = get_db()
            if isinstance(relationship_id, str):
                relationship_id = ObjectId(relationship_id)
            
            data = db.conversations.find_one({'relationship_id': relationship_id})
            log_database_operation('find_one', 'conversations', {'relationship_id': relationship_id}, data)

            if data:
                conversation = Conversation.from_dict(data)
                conversation._id = data['_id']
                return conversation
            return None

        except Exception as e:
            logging.error(f"Error finding conversation by relationship: {str(e)}")
            raise e

    @staticmethod
    def find_or_create(patient_id, physician_id, relationship_id):
        """Find existing conversation or create new one"""
        try:
            db = get_db()
            if isinstance(patient_id, str):
                patient_id = ObjectId(patient_id)
            if isinstance(physician_id, str):
                physician_id = ObjectId(physician_id)
            if isinstance(relationship_id, str):
                relationship_id = ObjectId(relationship_id)
            
            data = db.conversations.find_one({
                'patient_id': patient_id,
                'physician_id': physician_id
            })

            if data:
                conversation = Conversation.from_dict(data)
                conversation._id = data['_id']
                return conversation
            
            # Create new conversation
            conversation = Conversation(patient_id, physician_id, relationship_id)
            conversation.save()
            return conversation

        except Exception as e:
            logging.error(f"Error finding or creating conversation: {str(e)}")
            raise e

    @staticmethod
    def find_by_user(user_id, user_role):
        """Find all conversations for a user"""
        try:
            db = get_db()
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            
            if user_role == 'physician':
                query = {'physician_id': user_id}
            else:
                query = {'patient_id': user_id}
            
            cursor = db.conversations.find(query).sort('last_message_at', -1)
            
            conversations = []
            for data in cursor:
                conversation = Conversation.from_dict(data)
                conversation._id = data['_id']
                conversations.append(conversation)
            
            log_database_operation('find', 'conversations', query, f"Found {len(conversations)} conversations")
            return conversations

        except Exception as e:
            logging.error(f"Error finding conversations by user: {str(e)}")
            raise e

    def update_last_message(self, message_content, sender_role):
        """Update last message and unread counts"""
        try:
            db = get_db()
            
            update_data = {
                'last_message': message_content[:100] if len(message_content) > 100 else message_content,
                'last_message_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            # Increment unread count for the other party
            if sender_role == 'patient':
                update_data['physician_unread_count'] = self.physician_unread_count + 1
            else:
                update_data['patient_unread_count'] = self.patient_unread_count + 1
            
            result = db.conversations.update_one(
                {'_id': self._id},
                {'$set': update_data}
            )
            
            # Update local instance
            self.last_message = update_data['last_message']
            self.last_message_at = update_data['last_message_at']
            if sender_role == 'patient':
                self.physician_unread_count += 1
            else:
                self.patient_unread_count += 1
            
            log_database_operation('update_one', 'conversations', {'_id': self._id}, result)
            return result

        except Exception as e:
            logging.error(f"Error updating last message: {str(e)}")
            raise e

    def reset_unread_count(self, reader_role):
        """Reset unread count for a user"""
        try:
            db = get_db()
            
            if reader_role == 'physician':
                update_data = {'physician_unread_count': 0}
                self.physician_unread_count = 0
            else:
                update_data = {'patient_unread_count': 0}
                self.patient_unread_count = 0
            
            result = db.conversations.update_one(
                {'_id': self._id},
                {'$set': update_data}
            )
            
            log_database_operation('update_one', 'conversations', {'_id': self._id}, result)
            return result

        except Exception as e:
            logging.error(f"Error resetting unread count: {str(e)}")
            raise e
