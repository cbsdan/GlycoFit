# FCM Notification Navigation Implementation

## Overview
Implemented comprehensive navigation for Firebase Cloud Messaging (FCM) push notifications in both the mobile and physician apps. When users tap on notifications, they are automatically navigated to the appropriate screen based on the notification type.

## Supported Notification Types

### Mobile App (Patient)
- **chat_message**: Navigate to chat with physician
- **appointment**: Navigate to physician communication (appointments)
- **prescription**: Navigate to physician communication (prescriptions)
- **assessment_reminder**: Navigate to diabetes risk assessment
- **health_metrics**: Navigate to health data screen
- **meal_log**: Navigate to meal history
- **chatbot**: Navigate to AI chatbot
- **general**: Navigate to custom screen or home

### Physician App
- **chat_message**: Navigate to chat with patient
- **appointment**: Navigate to schedule/appointments
- **consultation**: Navigate to telehealth consultations
- **patient_alert**: Navigate to patients list
- **prescription**: Navigate to patients screen
- **general**: Navigate to custom screen or dashboard

## Changes Made

### 1. Backend - FCM Service (`backend/services/fcm_service.py`)

#### Enhanced Class Documentation:
- Added comprehensive documentation with examples for all supported notification types
- Documented usage patterns for appointments, prescriptions, assessments, and custom navigations

#### Added Helper Methods:
1. **send_appointment_notification()** - Send appointment reminders/updates
2. **send_prescription_notification()** - Send prescription notifications to patients
3. **send_consultation_notification()** - Send consultation notifications to physicians
4. **send_assessment_reminder()** - Send health assessment reminders
5. **send_health_metrics_reminder()** - Send health metrics logging reminders
6. **send_patient_alert()** - Send patient alerts to physicians

#### Updated `send_chat_notification` method:
- Added two new parameters:
  - `relationship_id`: ID of the patient-physician relationship
  - `sender_id`: ID of the message sender
- Enhanced notification data payload with navigation information:
  - `relationship_id`: For reconstructing relationship object
  - Role-specific IDs:
    - For patients: `physician_id`, `physician_name`, `patient_id`
    - For physicians: `patient_id`, `patient_name`, `physician_id`
  - `recipient_role`: To identify if notification is for patient or physician

### 2. Backend - Chat Controller (`backend/controllers/chat_controller.py`)

#### Updated in two locations:
1. **Socket message handler** - Added relationship_id and sender_id when sending notifications
2. **Send image handler** - Added relationship_id and sender_id when sending image notifications

Both now pass:
```python
relationship_id=str(conversation.relationship_id),
sender_id=str(sender_id)  # or current_user._id for image handler
```

### 3. Mobile App (`mobile/App.js`)

#### FCMHandler Component:
- Added `navigationRef` prop to receive navigation reference
- Implemented `handleNotificationNavigation` function with **switch statement** handling multiple notification types:
  - **chat_message**: Extracts relationship and physician data, navigates to PhysicianMessages
  - **appointment**: Navigates to PhysicianCommunication screen
  - **prescription**: Navigates to PhysicianCommunication screen
  - **assessment_reminder**: Navigates to DiabetesRiskAssessment screen
  - **health_metrics**: Navigates to HealthData screen via Settings tab
  - **meal_log**: Navigates to MealHistory screen
  - **chatbot**: Navigates to ChatBot screen
  - **general/default**: Navigates to specified screen from data or defaults to home

#### Navigation Setup:
- Added `FCMHandler` component inside `NavigationContainer`
- Passed `navigationRef` from `AppNavigator` to `FCMHandler`
- Handles notifications in three states:
  1. **App opened from quit state** - with 1 second delay for navigation readiness
  2. **App opened from background state** - immediate navigation
  3. **Foreground messages** - logged but no auto-navigation (user can tap in-app notification)

### 4. Physician App (`physician/App.js`)

#### FCMHandler Component:
- Similar implementation to mobile app
- Implemented `handleNotificationNavigation` function with **switch statement** handling multiple notification types:
  - **chat_message**: Extracts patient and relationship data, navigates to PatientChat
  - **appointment**: Navigates to Schedule screen
  - **consultation**: Navigates to Consultations screen
  - **patient_alert**: Navigates to Patients screen
  - **prescription**: Navigates to Patients screen
  - **general/default**: Navigates to specified screen from data or defaults to dashboard

#### Navigation Setup:
- Added `navigationRef` to `AppContent` component
- Passed `navigationRef` to both `NavigationContainer` and `FCMHandler`
- Moved `FCMHandler` inside the fragment wrapper with navigation
- Same three-state notification handling as mobile app

## Usage Examples

### Sending Different Notification Types from Backend

#### 1. Appointment Reminder
```python
from services.fcm_service import FCMService

# Send appointment reminder to patient
FCMService.send_appointment_notification(
    user_id=patient_id,
    title="Appointment Reminder",
    body="You have an appointment tomorrow at 10:00 AM with Dr. Smith",
    appointment_id=appointment_id
)

# Or use the general method with custom data
FCMService.send_notification_to_user(
    user_id=patient_id,
    title="Appointment Confirmed",
    body="Your appointment has been confirmed",
    data={
        'type': 'appointment',
        'appointment_id': str(appointment_id),
        'physician_name': 'Dr. Smith'
    }
)
```

#### 2. Prescription Notification
```python
# Send prescription notification to patient
FCMService.send_prescription_notification(
    user_id=patient_id,
    title="New Prescription",
    body="Dr. Johnson has prescribed Metformin for you",
    prescription_id=prescription_id
)
```

#### 3. Consultation Request
```python
# Notify physician about consultation request
FCMService.send_consultation_notification(
    physician_id=physician_user_id,
    title="New Consultation Request",
    body="Patient Jane Doe has requested a telehealth consultation",
    consultation_id=consultation_id
)
```

#### 4. Health Assessment Reminder
```python
# Remind patient to complete assessment
FCMService.send_assessment_reminder(
    user_id=patient_id,
    title="Time for Your Health Check",
    body="Complete your monthly diabetes risk assessment"
)
```

#### 5. Patient Alert to Physician
```python
# Alert physician about patient health concern
FCMService.send_patient_alert(
    physician_id=physician_user_id,
    title="Patient Alert",
    body="John Doe reported high blood glucose levels",
    patient_id=patient_id
)
```

#### 6. Custom Navigation
```python
# Navigate to specific screen with parameters
FCMService.send_notification_to_user(
    user_id=user_id,
    title="Custom Notification",
    body="Check your latest meal analysis",
    data={
        'type': 'general',
        'screen': 'MealDetail',
        'params': json.dumps({'mealId': str(meal_id)})
    }
)
```

## Notification Data Structure Examples

### Chat Message (Already Implemented)
```javascript
{
  type: 'chat_message',
  conversation_id: 'xxx',
  relationship_id: 'xxx',
  sender_name: 'Dr. John Doe',
  recipient_role: 'patient',
  physician_id: 'xxx',
  physician_name: 'Dr. John Doe',
  patient_id: 'xxx'
}
```

### Appointment
```javascript
{
  type: 'appointment',
  appointment_id: 'xxx'
}
```

### Prescription
```javascript
{
  type: 'prescription',
  prescription_id: 'xxx'
}
```

### Assessment Reminder
```javascript
{
  type: 'assessment_reminder'
}
```

### Custom Navigation
```javascript
{
  type: 'general',
  screen: 'ScreenName',
  params: '{"key": "value"}'  // JSON string
}
```

### Chat Notification Flow:

1. **Message Sent**: User sends a chat message
2. **Backend Processing**: 
   - Chat controller receives the message
   - Calls `FCMService.send_chat_notification()` with all necessary data
3. **FCM Service**:
   - Builds notification with title and body
   - Adds navigation data to `data` payload
   - Sends to recipient's FCM tokens
4. **Mobile/Physician App Receives**:
   - FCM handler receives the notification
   - Extracts data from notification payload
   - Constructs appropriate navigation parameters
5. **Navigation**:
   - Navigates to chat screen with correct relationship/patient data
   - Chat screen initializes with the conversation

### Notification Data Structure:

```javascript
{
  type: 'chat_message',
  conversation_id: 'xxx',
  relationship_id: 'xxx',
  sender_name: 'Dr. John Doe',
  recipient_role: 'patient',
  
  // For patient notifications:
  physician_id: 'xxx',
  physician_name: 'Dr. John Doe',
  patient_id: 'xxx',
  
  // For physician notifications:
  patient_id: 'xxx',
  patient_name: 'Jane Smith',
  physician_id: 'xxx'
}
```

## Screen Navigation

### Mobile App (Patient)
- **Notification Type**: Chat message from physician
- **Target Screen**: `PhysicianMessages`
- **Required Params**: `relationship` object containing physician details

### Physician App
- **Notification Type**: Chat message from patient
- **Target Screen**: `PatientChat`
- **Required Params**: `patient` and `relationship` objects

## Testing

### Testing Different Notification Types

1. **Chat Messages** (Already implemented in controllers)
   - Send a chat message from physician to patient
   - Tap notification → Should open PhysicianMessages screen

2. **Appointment Notifications**
   ```python
   # In appointment controller after creating appointment
   FCMService.send_appointment_notification(
       user_id=patient_id,
       title="Appointment Scheduled",
       body=f"Appointment with Dr. {physician_name} on {date}",
       appointment_id=appointment_id
   )
   ```
   - Tap notification → Should navigate to PhysicianCommunication

3. **Prescription Notifications**
   ```python
   # In prescription controller after creating prescription
   FCMService.send_prescription_notification(
       user_id=patient_id,
       title="New Prescription",
       body=f"Dr. {physician_name} prescribed {medication_name}",
       prescription_id=prescription_id
   )
   ```
   - Tap notification → Should navigate to PhysicianCommunication

4. **Assessment Reminders**
   ```python
   # Schedule or send manually
   FCMService.send_assessment_reminder(user_id=patient_id)
   ```
   - Tap notification → Should navigate to DiabetesRiskAssessment

5. **General Notifications**
   - Test custom screen navigation with data.screen parameter
   - Verify fallback to home screen when no specific screen

### Testing Checklist
- [ ] App closed completely - notification opens app and navigates
- [ ] App in background - notification brings app forward and navigates
- [ ] App in foreground - notification logs but doesn't auto-navigate
- [ ] Each notification type navigates to correct screen
- [ ] Navigation with parameters works correctly
- [ ] Both mobile and physician apps handle notifications properly

## Adding New Notification Types

The notification navigation system is **fully extensible**. To add new notification types:

### 1. Add to Backend (fcm_service.py)
```python
@staticmethod
def send_new_type_notification(user_id, title, body, additional_data):
    """Send new type notification"""
    data = {
        'type': 'new_type',
        'custom_field': str(additional_data)
    }
    
    return FCMService.send_notification_to_user(
        user_id=user_id,
        title=title,
        body=body,
        data=data
    )
```

### 2. Add to Mobile App (mobile/App.js)
```javascript
// In handleNotificationNavigation switch statement
case 'new_type':
    // Extract data and navigate
    const customData = data.custom_field;
    navigationRef.current.navigate('TargetScreen', { customData });
    break;
```

### 3. Add to Physician App (physician/App.js)
```javascript
// In handleNotificationNavigation switch statement
case 'new_type':
    // Extract data and navigate
    navigationRef.current.navigate('Main', {
        screen: 'TargetTab',
        params: { data: data.custom_field }
    });
    break;
```

## Notes

- Notifications are only sent if the user has push notifications enabled
- Invalid/expired FCM tokens are automatically removed from the database
- Navigation is delayed by 1 second when app opens from quit state to ensure navigation is ready
- Foreground notifications don't auto-navigate to avoid interrupting user's current activity
