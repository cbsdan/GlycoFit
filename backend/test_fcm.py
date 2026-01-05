"""
FCM Test Script
Run this script to test sending notifications to users

Usage:
    python test_fcm.py

Make sure:
1. Backend server is running
2. User is logged in on mobile app
3. You have a valid user_id from the database
"""

from services.fcm_service import FCMService
from config.database import get_db
from bson import ObjectId
import sys

def test_notification_to_user(user_id):
    """Test sending notification to specific user"""
    print(f"\n📱 Testing notification to user: {user_id}")
    
    result = FCMService.send_notification_to_user(
        user_id=user_id,
        title="Test Notification",
        body="This is a test notification from GlycoFit!",
        data={
            'type': 'test',
            'timestamp': str(ObjectId())
        }
    )
    
    print(f"✅ Result: {result}")
    return result

def test_notification_with_image(user_id):
    """Test sending notification with image"""
    print(f"\n🖼️  Testing notification with image to user: {user_id}")
    
    result = FCMService.send_notification_to_user(
        user_id=user_id,
        title="Health Tip",
        body="Stay hydrated! Drink plenty of water throughout the day.",
        image_url="https://via.placeholder.com/400x200/4CAF50/FFFFFF?text=Stay+Hydrated",
        data={
            'type': 'health_tip',
            'tip_id': 'tip_001'
        }
    )
    
    print(f"✅ Result: {result}")
    return result

def test_appointment_notification(user_id):
    """Test appointment notification"""
    print(f"\n📅 Testing appointment notification to user: {user_id}")
    
    result = FCMService.send_notification_to_user(
        user_id=user_id,
        title="Appointment Reminder",
        body="You have an appointment with Dr. Smith tomorrow at 10:00 AM",
        data={
            'type': 'appointment',
            'appointment_id': str(ObjectId()),
            'action': 'reminder',
            'screen': 'AppointmentDetail'
        }
    )
    
    print(f"✅ Result: {result}")
    return result

def test_chat_notification(user_id):
    """Test chat message notification"""
    print(f"\n💬 Testing chat notification to user: {user_id}")
    
    result = FCMService.send_notification_to_user(
        user_id=user_id,
        title="New Message from Dr. Johnson",
        body="Your test results look good. Let's discuss in our next session.",
        data={
            'type': 'chat',
            'conversation_id': str(ObjectId()),
            'sender_id': str(ObjectId())
        }
    )
    
    print(f"✅ Result: {result}")
    return result

def test_multiple_notifications(user_id):
    """Send multiple test notifications"""
    print(f"\n🔔 Sending multiple test notifications to user: {user_id}")
    
    notifications = [
        {
            'title': 'Glucose Alert',
            'body': 'Your glucose level is slightly elevated. Consider a light walk.',
            'data': {'type': 'glucose_alert'}
        },
        {
            'title': 'Medication Reminder',
            'body': 'Time to take your evening medication',
            'data': {'type': 'medication_reminder'}
        },
        {
            'title': 'Weekly Report Ready',
            'body': 'Your weekly health report is now available',
            'data': {'type': 'report', 'report_type': 'weekly'}
        }
    ]
    
    for notif in notifications:
        result = FCMService.send_notification_to_user(
            user_id=user_id,
            title=notif['title'],
            body=notif['body'],
            data=notif['data']
        )
        print(f"  ✅ Sent: {notif['title']} - {result['success']}")

def list_users_with_tokens():
    """List all users who have FCM tokens"""
    print("\n👥 Users with FCM tokens:")
    
    db = get_db()
    users = db.users.find(
        {'push_tokens': {'$exists': True, '$ne': []}},
        {'_id': 1, 'first_name': 1, 'last_name': 1, 'email': 1, 'push_tokens': 1}
    )
    
    user_list = []
    for user in users:
        token_count = len(user.get('push_tokens', []))
        print(f"  • {user['first_name']} {user['last_name']} ({user['email']})")
        print(f"    ID: {str(user['_id'])}")
        print(f"    Tokens: {token_count} device(s)")
        user_list.append(str(user['_id']))
    
    return user_list

def interactive_test():
    """Interactive testing menu"""
    print("=" * 60)
    print("🔥 GlycoFit FCM Notification Test Script")
    print("=" * 60)
    
    # First, list users with tokens
    user_list = list_users_with_tokens()
    
    if not user_list:
        print("\n❌ No users with FCM tokens found!")
        print("   Make sure at least one user is logged in on the mobile app.")
        return
    
    print("\n" + "=" * 60)
    print("Select a test:")
    print("1. Send basic test notification")
    print("2. Send notification with image")
    print("3. Send appointment notification")
    print("4. Send chat notification")
    print("5. Send multiple notifications")
    print("6. Exit")
    print("=" * 60)
    
    choice = input("\nEnter your choice (1-6): ").strip()
    
    if choice == '6':
        print("👋 Goodbye!")
        return
    
    user_id = input("\nEnter user ID (or press Enter for first user): ").strip()
    if not user_id:
        user_id = user_list[0]
        print(f"Using user ID: {user_id}")
    
    try:
        if choice == '1':
            test_notification_to_user(user_id)
        elif choice == '2':
            test_notification_with_image(user_id)
        elif choice == '3':
            test_appointment_notification(user_id)
        elif choice == '4':
            test_chat_notification(user_id)
        elif choice == '5':
            test_multiple_notifications(user_id)
        else:
            print("❌ Invalid choice!")
            return
        
        print("\n✅ Test completed! Check your mobile device.")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        interactive_test()
    except KeyboardInterrupt:
        print("\n\n👋 Test interrupted. Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
