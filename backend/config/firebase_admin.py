import firebase_admin
from firebase_admin import credentials, auth, messaging
import os
import logging
import json

# Global Firebase app instance
firebase_app = None

def init_firebase():
    """Initialize Firebase Admin SDK"""
    global firebase_app
    
    try:
        # Construct service account from environment variables
        service_account_info = {
            "type": os.getenv('FIREBASE_TYPE'),
            "project_id": os.getenv('FIREBASE_PROJECT_ID'),
            "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
            "private_key": os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n'),
            "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
            "client_id": os.getenv('FIREBASE_CLIENT_ID'),
            "auth_uri": os.getenv('FIREBASE_AUTH_URI'),
            "token_uri": os.getenv('FIREBASE_TOKEN_URI'),
            "auth_provider_x509_cert_url": os.getenv('FIREBASE_AUTH_PROVIDER_CERT_URL'),
            "client_x509_cert_url": os.getenv('FIREBASE_CLIENT_CERT_URL'),
            "universe_domain": os.getenv('FIREBASE_UNIVERSE_DOMAIN')
        }
        
        # Validate required fields
        required_fields = ['type', 'project_id', 'private_key', 'client_email']
        missing_fields = [field for field in required_fields if not service_account_info.get(field)]
        
        if missing_fields:
            raise ValueError(f"Missing required Firebase environment variables: {', '.join(missing_fields)}")
        
        # Create credentials from service account info
        cred = credentials.Certificate(service_account_info)
        
        # Initialize Firebase app
        firebase_app = firebase_admin.initialize_app(cred)
        
        logging.info("Firebase Admin SDK initialized successfully")
        return firebase_app
        
    except Exception as e:
        logging.error(f"Failed to initialize Firebase Admin SDK: {str(e)}")
        raise e

def get_firebase_app():
    """Get Firebase app instance"""
    global firebase_app
    if firebase_app is None:
        firebase_app = init_firebase()
    return firebase_app

class FirebaseAuth:
    """Firebase Authentication helper class"""
    
    @staticmethod
    def verify_id_token(id_token):
        """Verify Firebase ID token"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            decoded_token = auth.verify_id_token(id_token)
            logging.info(f"Token verified for user: {decoded_token.get('uid')}")
            return decoded_token
        except Exception as e:
            logging.error(f"Token verification failed: {str(e)}")
            raise e
    
    @staticmethod
    def get_user(uid):
        """Get user by UID"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            user_record = auth.get_user(uid)
            logging.info(f"Firebase user retrieved: {uid}")
            return {
                'uid': user_record.uid,
                'email': user_record.email,
                'email_verified': user_record.email_verified,
                'display_name': user_record.display_name,
                'photo_url': user_record.photo_url,
                'disabled': user_record.disabled,
                'metadata': {
                    'creation_time': user_record.user_metadata.creation_timestamp,
                    'last_sign_in_time': user_record.user_metadata.last_sign_in_timestamp
                }
            }
        except Exception as e:
            logging.error(f"Failed to get Firebase user {uid}: {str(e)}")
            raise e
    
    @staticmethod
    def create_custom_token(uid, additional_claims=None):
        """Create custom token for user"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            custom_token = auth.create_custom_token(uid, additional_claims)
            logging.info(f"Custom token created for user: {uid}")
            return custom_token.decode('utf-8')
        except Exception as e:
            logging.error(f"Failed to create custom token for {uid}: {str(e)}")
            raise e
    
    @staticmethod
    def set_custom_user_claims(uid, custom_claims):
        """Set custom claims for user"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            auth.set_custom_user_claims(uid, custom_claims)
            logging.info(f"Custom claims set for user: {uid}")
            return True
        except Exception as e:
            logging.error(f"Failed to set custom claims for {uid}: {str(e)}")
            raise e
    
    @staticmethod
    def disable_user(uid):
        """Disable Firebase user"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            auth.update_user(uid, disabled=True)
            logging.info(f"Firebase user disabled: {uid}")
            return True
        except Exception as e:
            logging.error(f"Failed to disable Firebase user {uid}: {str(e)}")
            raise e
    
    @staticmethod
    def enable_user(uid):
        """Enable Firebase user"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            auth.update_user(uid, disabled=False)
            logging.info(f"Firebase user enabled: {uid}")
            return True
        except Exception as e:
            logging.error(f"Failed to enable Firebase user {uid}: {str(e)}")
            raise e
    
    @staticmethod
    def delete_user(uid):
        """Delete Firebase user"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            auth.delete_user(uid)
            logging.info(f"Firebase user deleted: {uid}")
            return True
        except Exception as e:
            logging.error(f"Failed to delete Firebase user {uid}: {str(e)}")
            raise e

class FirebaseMessaging:
    """Firebase Cloud Messaging helper class"""
    
    @staticmethod
    def send_notification(token, title, body, data=None):
        """Send push notification to a single device"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                token=token
            )
            
            response = messaging.send(message)
            logging.info(f"Notification sent successfully: {response}")
            return response
            
        except Exception as e:
            logging.error(f"Failed to send notification: {str(e)}")
            raise e
    
    @staticmethod
    def send_multicast_notification(tokens, title, body, data=None):
        """Send push notification to multiple devices"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                tokens=tokens
            )
            
            response = messaging.send_multicast(message)
            logging.info(f"Multicast notification sent: {response.success_count} successful, {response.failure_count} failed")
            return response
            
        except Exception as e:
            logging.error(f"Failed to send multicast notification: {str(e)}")
            raise e
    
    @staticmethod
    def send_topic_notification(topic, title, body, data=None):
        """Send push notification to a topic"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                topic=topic
            )
            
            response = messaging.send(message)
            logging.info(f"Topic notification sent successfully: {response}")
            return response
            
        except Exception as e:
            logging.error(f"Failed to send topic notification: {str(e)}")
            raise e
    
    @staticmethod
    def subscribe_to_topic(tokens, topic):
        """Subscribe tokens to a topic"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            response = messaging.subscribe_to_topic(tokens, topic)
            logging.info(f"Subscribed {response.success_count} tokens to topic '{topic}'")
            return response
        except Exception as e:
            logging.error(f"Failed to subscribe to topic {topic}: {str(e)}")
            raise e
    
    @staticmethod
    def unsubscribe_from_topic(tokens, topic):
        """Unsubscribe tokens from a topic"""
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            response = messaging.unsubscribe_from_topic(tokens, topic)
            logging.info(f"Unsubscribed {response.success_count} tokens from topic '{topic}'")
            return response
        except Exception as e:
            logging.error(f"Failed to unsubscribe from topic {topic}: {str(e)}")
            raise e

# Utility functions for easy access
def verify_firebase_token(id_token):
    """Convenience function to verify Firebase ID token"""
    return FirebaseAuth.verify_id_token(id_token)

def get_firebase_user(uid):
    """Convenience function to get Firebase user"""
    return FirebaseAuth.get_user(uid)

def send_push_notification(token, title, body, data=None):
    """Convenience function to send push notification"""
    return FirebaseMessaging.send_notification(token, title, body, data)
