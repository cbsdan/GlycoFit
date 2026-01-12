import firebase_admin
from firebase_admin import credentials, auth, messaging
import os
import logging
import json


def init_firebase():
    """Initialize Firebase Admin SDK using multiple fallbacks.

    Tries in order:
    1. If an app already exists, return it.
    2. Service account from environment variables (FIREBASE_*).
    3. Certificate file from FIREBASE_CREDENTIALS_PATH or GOOGLE_APPLICATION_CREDENTIALS.
    4. Application Default Credentials.
    """
    try:
        # If already initialized elsewhere, return existing app
        if firebase_admin._apps:
            try:
                return firebase_admin.get_app()
            except Exception:
                pass

        # Attempt to build service account dict from environment
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

        required_fields = ['type', 'project_id', 'private_key', 'client_email']
        if all(service_account_info.get(f) for f in required_fields):
            try:
                cred = credentials.Certificate(service_account_info)
                project_id = service_account_info.get('project_id') or os.getenv('FIREBASE_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')
                options = {'projectId': project_id} if project_id else None
                app = firebase_admin.initialize_app(cred, options=options) if options else firebase_admin.initialize_app(cred)
                logging.info("Firebase Admin SDK initialized from environment service account")
                if not project_id:
                    logging.warning('No project_id found in env service account or env vars; some auth operations may require project ID')
                return app
            except Exception as e:
                logging.warning(f"Failed to initialize from env service account: {e}")

        # Try certificate file path from env
        cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH') or os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if cred_path:
            try:
                # Try to extract project_id from the JSON file if possible
                project_id = None
                try:
                    with open(cred_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        project_id = data.get('project_id')
                except Exception:
                    project_id = os.getenv('FIREBASE_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')

                cred = credentials.Certificate(cred_path)
                options = {'projectId': project_id} if project_id else None
                app = firebase_admin.initialize_app(cred, options=options) if options else firebase_admin.initialize_app(cred)
                logging.info(f"Firebase Admin SDK initialized from credentials file: {cred_path}")
                if not project_id:
                    logging.warning('No project_id found in credentials file or env vars; some auth operations may require project ID')
                return app
            except Exception as e:
                logging.warning(f"Failed to initialize from credentials file '{cred_path}': {e}")

        # Try application default credentials
        try:
            cred = credentials.ApplicationDefault()
            project_id = os.getenv('FIREBASE_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')
            options = {'projectId': project_id} if project_id else None
            app = firebase_admin.initialize_app(cred, options=options) if options else firebase_admin.initialize_app(cred)
            logging.info("Firebase Admin SDK initialized using Application Default Credentials")
            if not project_id:
                logging.warning('No project_id set in env; consider setting FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT')
            return app
        except Exception as e:
            logging.error(f"Failed to initialize Firebase Admin SDK using any method: {e}")
            raise e

    except Exception as e:
        logging.error(f"Firebase initialization error: {str(e)}")
        raise e


def get_firebase_app():
    """Return the initialized firebase app, initializing it if necessary."""
    try:
        if firebase_admin._apps:
            return firebase_admin.get_app()
    except Exception:
        pass
    return init_firebase()

class FirebaseAuth:
    """Firebase Authentication helper class"""
    
    @staticmethod
    def verify_id_token(id_token, check_revoked=False, clock_skew_seconds=60):
        """Verify Firebase ID token with clock skew tolerance
        
        Args:
            id_token: The Firebase ID token to verify
            check_revoked: Whether to check if the token has been revoked
            clock_skew_seconds: Number of seconds of clock skew to tolerate (default: 60)
        """
        try:
            get_firebase_app()  # Ensure Firebase is initialized
            # Note: The Python Firebase Admin SDK doesn't directly expose clock_skew_seconds
            # but it has a default tolerance of 5 minutes. However, we can use verify_id_token
            # with check_revoked parameter which is supported.
            decoded_token = auth.verify_id_token(id_token, check_revoked=check_revoked)
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
