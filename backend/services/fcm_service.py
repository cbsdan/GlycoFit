import logging
from firebase_admin import messaging
from config.database import get_db
from bson import ObjectId

class FCMService:
    """
    Service for sending Firebase Cloud Messaging notifications
    
    Supported notification types for navigation:
    - chat_message: Navigates to chat/messaging screen
    - appointment: Navigates to appointments/schedule screen
    - prescription: Navigates to prescriptions screen
    - consultation: Navigates to consultations/telehealth screen (physician app)
    - assessment_reminder: Navigates to diabetes assessment (mobile app)
    - health_metrics: Navigates to health data screen (mobile app)
    - meal_log: Navigates to meal history (mobile app)
    - chatbot: Navigates to chatbot screen (mobile app)
    - patient_alert: Navigates to patients list (physician app)
    - general: Navigates to specified screen or home
    
    Example usage for different notification types:
    
    # Appointment reminder
    FCMService.send_notification_to_user(
        user_id=patient_id,
        title="Appointment Reminder",
        body="You have an appointment tomorrow at 10 AM",
        data={
            'type': 'appointment',
            'appointment_id': str(appointment_id)
        }
    )
    
    # Prescription notification
    FCMService.send_notification_to_user(
        user_id=patient_id,
        title="New Prescription",
        body="Dr. Smith has prescribed a new medication",
        data={
            'type': 'prescription',
            'prescription_id': str(prescription_id)
        }
    )
    
    # Assessment reminder
    FCMService.send_notification_to_user(
        user_id=patient_id,
        title="Health Assessment Due",
        body="It's time to complete your diabetes risk assessment",
        data={'type': 'assessment_reminder'}
    )
    
    # Custom screen navigation
    FCMService.send_notification_to_user(
        user_id=user_id,
        title="Custom Notification",
        body="Check your latest results",
        data={
            'type': 'general',
            'screen': 'SpecificScreen',
            'params': '{"id": "some_id"}'  # JSON string
        }
    )
    """
    
    @staticmethod
    def send_notification_to_user(user_id, title, body, data=None, image_url=None):
        """
        Send push notification to a specific user
        
        Args:
            user_id: User's database ID
            title: Notification title
            body: Notification body text
            data: Optional dict of custom data to include
            image_url: Optional image URL for the notification
            
        Returns:
            dict: Success status and message
        """
        try:
            db = get_db()
            
            # Get user's FCM tokens
            user = db.users.find_one({'_id': ObjectId(user_id)})
            if not user:
                return {
                    'success': False,
                    'error': 'User not found'
                }
            
            push_tokens = user.get('push_tokens', [])
            if not push_tokens:
                return {
                    'success': False,
                    'error': 'No FCM tokens registered for this user'
                }
            
            # Check if user has push notifications enabled
            if not user.get('enable_push_notifications', True):
                return {
                    'success': False,
                    'error': 'User has disabled push notifications'
                }
            
            # Build notification
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            # Build message with data
            message_data = data or {}
            
            # Track results
            success_count = 0
            failure_count = 0
            invalid_tokens = []
            
            # Send to each token
            for token in push_tokens:
                try:
                    message = messaging.Message(
                        notification=notification,
                        data=message_data,
                        token=token,
                        android=messaging.AndroidConfig(
                            priority='high',
                            notification=messaging.AndroidNotification(
                                sound='default'
                            )
                        ),
                        apns=messaging.APNSConfig(
                            payload=messaging.APNSPayload(
                                aps=messaging.Aps(
                                    sound='default',
                                    badge=1
                                )
                            )
                        )
                    )
                    
                    response = messaging.send(message)
                    success_count += 1
                    logging.info(f"Successfully sent message to token: {token[:10]}... Response: {response}")
                    
                except messaging.UnregisteredError:
                    # Token is no longer valid, mark for removal
                    invalid_tokens.append(token)
                    failure_count += 1
                    logging.warning(f"Token is unregistered: {token[:10]}...")
                    
                except Exception as e:
                    failure_count += 1
                    logging.error(f"Failed to send message to token {token[:10]}...: {str(e)}")
            
            # Remove invalid tokens
            if invalid_tokens:
                db.users.update_one(
                    {'_id': ObjectId(user_id)},
                    {'$pull': {'push_tokens': {'$in': invalid_tokens}}}
                )
                logging.info(f"Removed {len(invalid_tokens)} invalid tokens for user {user_id}")
            
            return {
                'success': success_count > 0,
                'message': f'Sent to {success_count} device(s), {failure_count} failed',
                'success_count': success_count,
                'failure_count': failure_count,
                'invalid_tokens_removed': len(invalid_tokens)
            }
            
        except Exception as e:
            logging.error(f"Error sending FCM notification: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def send_notification_to_multiple_users(user_ids, title, body, data=None, image_url=None):
        """
        Send push notification to multiple users
        
        Args:
            user_ids: List of user database IDs
            title: Notification title
            body: Notification body text
            data: Optional dict of custom data to include
            image_url: Optional image URL for the notification
            
        Returns:
            dict: Success status with counts
        """
        results = {
            'total_users': len(user_ids),
            'successful_users': 0,
            'failed_users': 0,
            'total_devices_reached': 0
        }
        
        for user_id in user_ids:
            result = FCMService.send_notification_to_user(
                user_id=user_id,
                title=title,
                body=body,
                data=data,
                image_url=image_url
            )
            
            if result['success']:
                results['successful_users'] += 1
                results['total_devices_reached'] += result.get('success_count', 0)
            else:
                results['failed_users'] += 1
        
        return results
    
    @staticmethod
    def send_to_topic(topic, title, body, data=None, image_url=None):
        """
        Send notification to a topic
        
        Args:
            topic: Topic name
            title: Notification title
            body: Notification body text
            data: Optional dict of custom data to include
            image_url: Optional image URL for the notification
            
        Returns:
            dict: Success status and message ID
        """
        try:
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            message = messaging.Message(
                notification=notification,
                data=data or {},
                topic=topic,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default'
                        )
                    )
                )
            )
            
            response = messaging.send(message)
            logging.info(f"Successfully sent message to topic {topic}. Response: {response}")
            
            return {
                'success': True,
                'message_id': response
            }
            
        except Exception as e:
            logging.error(f"Error sending FCM notification to topic: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def send_chat_notification(recipient_id, sender_name, message_content, conversation_id, recipient_role='patient', relationship_id=None, sender_id=None, sender_avatar_url=None):
        """
        Send push notification for a new chat message
        
        Args:
            recipient_id: Database ID of the message recipient
            sender_name: Name of the person who sent the message
            message_content: Content of the message (will be truncated if too long)
            conversation_id: ID of the conversation
            recipient_role: Role of the recipient ('patient' or 'physician')
            relationship_id: ID of the patient-physician relationship (optional)
            sender_id: ID of the sender (optional)
            sender_avatar_url: URL of the sender's avatar image (optional)
            
        Returns:
            dict: Success status and message
        """
        try:
            db = get_db()
            
            # Determine which collection to query based on role
            if recipient_role == 'physician':
                # For physicians, get tokens from physicians collection using user_id
                physician = db.physicians.find_one({'user_id': ObjectId(recipient_id)})
                if not physician:
                    return {'success': False, 'error': 'Physician not found'}
                push_tokens = physician.get('push_tokens', [])
            else:
                # For patients, get tokens from users collection
                user = db.users.find_one({'_id': ObjectId(recipient_id)})
                if not user:
                    return {'success': False, 'error': 'User not found'}
                push_tokens = user.get('push_tokens', [])
            
            if not push_tokens:
                return {
                    'success': False,
                    'error': f'No FCM tokens registered for this {recipient_role}'
                }
            
            # Truncate message if too long
            max_length = 100
            if len(message_content) > max_length:
                message_content = message_content[:max_length] + '...'
            
            # Build notification
            title = f"New message from {sender_name}"
            body = message_content
            
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Add conversation data for app to navigate to correct chat
            message_data = {
                'type': 'chat_message',
                'conversation_id': str(conversation_id),
                'sender_name': sender_name,
                'click_action': 'FLUTTER_NOTIFICATION_CLICK',
                'recipient_role': recipient_role
            }
            
            # Add relationship_id if provided
            if relationship_id:
                message_data['relationship_id'] = str(relationship_id)
            
            # Add sender and recipient IDs based on role for navigation
            if recipient_role == 'patient':
                # Patient receiving message from physician
                message_data['physician_id'] = str(sender_id) if sender_id else ''
                message_data['physician_name'] = sender_name
                message_data['patient_id'] = str(recipient_id)
                if sender_avatar_url:
                    message_data['physician_avatar_url'] = sender_avatar_url
            else:
                # Physician receiving message from patient
                message_data['patient_id'] = str(sender_id) if sender_id else ''
                message_data['patient_name'] = sender_name
                message_data['physician_id'] = str(recipient_id)
                if sender_avatar_url:
                    message_data['patient_avatar_url'] = sender_avatar_url
            
            # Track results
            success_count = 0
            failure_count = 0
            invalid_tokens = []
            
            # Send to each token
            for token in push_tokens:
                try:
                    message = messaging.Message(
                        notification=notification,
                        data=message_data,
                        token=token,
                        android=messaging.AndroidConfig(
                            priority='high',
                            notification=messaging.AndroidNotification(
                                sound='default',
                                channel_id='chat_messages'
                            )
                        ),
                        apns=messaging.APNSConfig(
                            payload=messaging.APNSPayload(
                                aps=messaging.Aps(
                                    sound='default',
                                    badge=1,
                                    category='CHAT_MESSAGE'
                                )
                            )
                        )
                    )
                    
                    response = messaging.send(message)
                    success_count += 1
                    logging.info(f"Chat notification sent to {recipient_role} {recipient_id}: {response}")
                    
                except messaging.UnregisteredError:
                    invalid_tokens.append(token)
                    failure_count += 1
                    logging.warning(f"Invalid token for {recipient_role} {recipient_id}: {token[:10]}...")
                    
                except Exception as e:
                    failure_count += 1
                    logging.error(f"Failed to send chat notification: {str(e)}")
            
            # Remove invalid tokens
            if invalid_tokens:
                if recipient_role == 'physician':
                    # For physicians, update by user_id
                    db.physicians.update_one(
                        {'user_id': ObjectId(recipient_id)},
                        {'$pull': {'push_tokens': {'$in': invalid_tokens}}}
                    )
                else:
                    # For patients, update by _id
                    db.users.update_one(
                        {'_id': ObjectId(recipient_id)},
                        {'$pull': {'push_tokens': {'$in': invalid_tokens}}}
                    )
                logging.info(f"Removed {len(invalid_tokens)} invalid tokens for {recipient_role} {recipient_id}")
            
            return {
                'success': success_count > 0,
                'message': f'Chat notification sent to {success_count} device(s)',
                'success_count': success_count,
                'failure_count': failure_count
            }
            
        except Exception as e:
            logging.error(f"Error sending chat notification: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def send_appointment_notification(user_id, title, body, appointment_id, is_physician=False):
        """
        Send appointment notification
        
        Args:
            user_id: User's database ID
            title: Notification title
            body: Notification body
            appointment_id: ID of the appointment
            is_physician: Whether recipient is a physician
        """
        data = {
            'type': 'appointment',
            'appointment_id': str(appointment_id)
        }
        
        return FCMService.send_notification_to_user(
            user_id=user_id,
            title=title,
            body=body,
            data=data
        )
    
    @staticmethod
    def send_prescription_notification(user_id, title, body, prescription_id):
        """
        Send prescription notification to patient
        
        Args:
            user_id: Patient's database ID
            title: Notification title
            body: Notification body
            prescription_id: ID of the prescription
        """
        data = {
            'type': 'prescription',
            'prescription_id': str(prescription_id)
        }
        
        return FCMService.send_notification_to_user(
            user_id=user_id,
            title=title,
            body=body,
            data=data
        )
    
    @staticmethod
    def send_consultation_notification(physician_id, title, body, consultation_id):
        """
        Send consultation notification to physician
        
        Args:
            physician_id: Physician's user database ID
            title: Notification title
            body: Notification body
            consultation_id: ID of the consultation
        """
        data = {
            'type': 'consultation',
            'consultation_id': str(consultation_id)
        }
        
        return FCMService.send_notification_to_user(
            user_id=physician_id,
            title=title,
            body=body,
            data=data
        )
    
    @staticmethod
    def send_assessment_reminder(user_id, title="Health Assessment Due", body="It's time to complete your diabetes risk assessment"):
        """
        Send assessment reminder notification to patient
        
        Args:
            user_id: Patient's database ID
            title: Notification title
            body: Notification body
        """
        data = {'type': 'assessment_reminder'}
        
        return FCMService.send_notification_to_user(
            user_id=user_id,
            title=title,
            body=body,
            data=data
        )
    
    @staticmethod
    def send_health_metrics_reminder(user_id, title="Update Your Health Metrics", body="Don't forget to log your health data today"):
        """
        Send health metrics reminder to patient
        
        Args:
            user_id: Patient's database ID
            title: Notification title
            body: Notification body
        """
        data = {'type': 'health_metrics'}
        
        return FCMService.send_notification_to_user(
            user_id=user_id,
            title=title,
            body=body,
            data=data
        )
    
    @staticmethod
    def send_patient_alert(physician_id, title, body, patient_id):
        """
        Send patient alert notification to physician
        
        Args:
            physician_id: Physician's user database ID
            title: Notification title
            body: Notification body
            patient_id: ID of the patient
        """
        data = {
            'type': 'patient_alert',
            'patient_id': str(patient_id)
        }
        
        return FCMService.send_notification_to_user(
            user_id=physician_id,
            title=title,
            body=body,
            data=data
        )
