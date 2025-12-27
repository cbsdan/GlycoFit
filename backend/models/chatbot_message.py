from datetime import datetime
from bson import ObjectId
from config.database import get_db
import logging

class ChatbotMessage:
    """Model for storing chatbot conversation messages"""
    
    @staticmethod
    def ensure_indexes():
        """Create necessary indexes for efficient queries"""
        try:
            db = get_db()
            # Index on user_id for faster user message lookups
            db.chatbot_messages.create_index('user_id')
            # Index on created_at for sorting and time-range queries
            db.chatbot_messages.create_index('created_at')
            # Compound index for user_id + created_at
            db.chatbot_messages.create_index([('user_id', 1), ('created_at', -1)])
            logging.info("Chatbot message indexes created successfully")
        except Exception as e:
            logging.error(f"Error creating indexes: {str(e)}")
    
    @staticmethod
    def create_message(user_id, user_message, bot_response):
        """
        Create and store a chatbot message exchange
        
        Args:
            user_id: User's ObjectId
            user_message: User's message text
            bot_response: Bot's response text
            
        Returns:
            dict: Created message document with _id
        """
        try:
            db = get_db()
            
            message_doc = {
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                'user_message': user_message,
                'bot_response': bot_response,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            result = db.chatbot_messages.insert_one(message_doc)
            message_doc['_id'] = result.inserted_id
            
            logging.info(f"Chatbot message saved for user {user_id}: {result.inserted_id}")
            return message_doc
            
        except Exception as e:
            logging.error(f"Error creating chatbot message: {str(e)}")
            raise
    
    @staticmethod
    def get_user_messages(user_id, limit=20, skip=0):
        """
        Get paginated chatbot messages for a user
        
        Args:
            user_id: User's ObjectId
            limit: Number of messages to fetch (default 20)
            skip: Number of messages to skip for pagination
            
        Returns:
            list: List of message documents sorted by most recent first
        """
        try:
            db = get_db()
            
            messages = list(db.chatbot_messages.find(
                {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id}
            ).sort('created_at', -1).skip(skip).limit(limit))
            
            # Convert ObjectId to string for JSON serialization
            for msg in messages:
                msg['_id'] = str(msg['_id'])
                msg['user_id'] = str(msg['user_id'])
                msg['created_at'] = msg['created_at'].isoformat() if isinstance(msg['created_at'], datetime) else msg['created_at']
            
            logging.info(f"Retrieved {len(messages)} chatbot messages for user {user_id}")
            return messages
            
        except Exception as e:
            logging.error(f"Error fetching chatbot messages: {str(e)}")
            raise
    
    @staticmethod
    def get_total_message_count(user_id):
        """
        Get total count of messages for a user
        
        Args:
            user_id: User's ObjectId
            
        Returns:
            int: Total message count
        """
        try:
            db = get_db()
            
            count = db.chatbot_messages.count_documents(
                {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id}
            )
            
            return count
            
        except Exception as e:
            logging.error(f"Error counting chatbot messages: {str(e)}")
            raise
    
    @staticmethod
    def delete_user_messages(user_id):
        """
        Delete all chatbot messages for a user
        
        Args:
            user_id: User's ObjectId
            
        Returns:
            dict: Deletion result with count of deleted documents
        """
        try:
            db = get_db()
            
            result = db.chatbot_messages.delete_many(
                {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id}
            )
            
            logging.info(f"Deleted {result.deleted_count} chatbot messages for user {user_id}")
            return {'deleted_count': result.deleted_count}
            
        except Exception as e:
            logging.error(f"Error deleting chatbot messages: {str(e)}")
            raise
    
    @staticmethod
    def search_messages(user_id, search_term):
        """
        Search chatbot messages by user message content
        
        Args:
            user_id: User's ObjectId
            search_term: Term to search for
            
        Returns:
            list: Matching message documents
        """
        try:
            db = get_db()
            
            messages = list(db.chatbot_messages.find(
                {
                    'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                    'user_message': {'$regex': search_term, '$options': 'i'}
                }
            ).sort('created_at', -1))
            
            # Convert ObjectId to string for JSON serialization
            for msg in messages:
                msg['_id'] = str(msg['_id'])
                msg['user_id'] = str(msg['user_id'])
                msg['created_at'] = msg['created_at'].isoformat() if isinstance(msg['created_at'], datetime) else msg['created_at']
            
            return messages
            
        except Exception as e:
            logging.error(f"Error searching chatbot messages: {str(e)}")
            raise
