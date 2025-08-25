# GlycoFit Backend

Python backend for the GlycoFit diabetes management application with Firebase authentication integration.

## Features

- **Firebase UID Authentication**: Integrates with Firebase Auth using UID references
- **MongoDB Integration**: Full database connectivity with proper indexing
- **Email Services**: OTP generation and welcome emails using Flask-Mail
- **Cloudinary Integration**: Image upload and management for avatars and documents
- **Request Logging**: Comprehensive logging of all incoming requests for debugging
- **Error Handling**: Proper error handling with detailed logging
- **User Management**: Profile management, glucose reading tracking, and user information
- **Admin Features**: User disable/enable functionality with audit trail
- **CORS Support**: Configured for mobile app integration

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Required packages:
- `flask`: Web framework
- `flask-cors`: Cross-origin resource sharing
- `pymongo`: MongoDB driver
- `python-dotenv`: Environment variables
- `flask-bcrypt`: Password hashing (if needed)
- `flask-jwt-extended`: JWT token management
- `flask-mail`: Email services
- `cloudinary`: Image upload and management

### 2. Environment Setup

Your `.env` file should include:

```env
# Database
DB_URI=mongodb+srv://username:password@cluster.mongodb.net/glycofit

# Server
PORT=4000
FLASK_ENV=development

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_TIME=7d

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME="GlycoFit"
SMTP_FROM_EMAIL=your-email@gmail.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Firebase (for future Firebase Admin integration)
FIREBASE_PROJECT_ID=your-project-id
# ... other Firebase config
```

### 3. Run the Application

```bash
python app.py
```

The server will start on the port specified in your `.env` file (default: 4000)

## API Endpoints

### Authentication (Firebase UID Based)
- `POST /api/auth/generate-otp` - Generate and send OTP for email verification
- `POST /api/auth/verify-otp` - Verify OTP code
- `POST /api/auth/register` - Register new user with Firebase UID
- `POST /api/auth/get-user` - Get user by Firebase UID

### User Management
- `PUT /api/auth/profile` - Update user profile
- `GET /api/users/glucose-readings` - Get glucose readings
- `POST /api/users/glucose-readings` - Add glucose reading

### User Information (Extended Profile)
- `GET /api/users/user-info` - Get all user info (admin)
- `GET /api/users/user-info/<user_id>` - Get specific user info
- `POST /api/users/user-info` - Create user info with document uploads
- `PUT /api/users/user-info/<info_id>` - Update user info
- `DELETE /api/users/user-info/<info_id>` - Delete user info

### Admin Routes
- `GET /api/auth/admin/users` - Get all users
- `GET /api/auth/admin/users/<user_id>` - Get user details
- `PUT /api/auth/admin/users/<user_id>/disable` - Disable user account
- `PUT /api/auth/admin/users/<user_id>/enable` - Enable user account

### Health Check
- `GET /api/health` - Service health check

## Project Structure

```
backend/
├── app.py                           # Main application file
├── requirements.txt                 # Python dependencies
├── .env                            # Environment variables
├── README.md                       # Documentation
├── config/
│   └── database.py                 # MongoDB connection and setup
├── middleware/
│   └── logging_middleware.py       # Request logging and debugging
├── models/
│   └── user.py                     # User model with disable/enable logic
├── controllers/
│   ├── auth_controller.py          # Authentication logic
│   └── user_info_controller.py     # Extended user information logic
├── routes/
│   ├── auth_routes.py              # Authentication endpoints
│   └── user_routes.py              # User management endpoints
├── services/
│   ├── email_service.py            # Email and OTP services
│   └── cloudinary_service.py       # Image upload services
└── logs/                           # Application logs (created automatically)
```

## Firebase Integration

This backend is designed to work with Firebase Authentication:

1. **User Registration Flow**:
   - User registers via Firebase Auth in your mobile app
   - Firebase provides a UID
   - Mobile app calls `/api/auth/register` with the Firebase UID
   - Backend creates user record linked to Firebase UID

2. **User Authentication Flow**:
   - User signs in via Firebase Auth in mobile app
   - Firebase provides UID and token
   - Mobile app calls `/api/auth/get-user` with UID to get user data
   - Backend returns user information if exists

3. **JWT Tokens**:
   - Backend issues its own JWT tokens for API access
   - These are separate from Firebase tokens
   - Used for securing API endpoints

## User Disable/Enable System

The user model includes a sophisticated disable/enable system:

- **Disable Records**: Track when and why users are disabled
- **Temporary Disables**: Set end dates for temporary suspensions
- **Permanent Disables**: No end date, requires manual enable
- **Audit Trail**: Complete history of disable/enable actions
- **Easy Management**: Simple methods to disable/enable users

## Email Services

Comprehensive email functionality:

- **OTP Generation**: 5-digit codes with 10-minute expiration
- **Welcome Emails**: Branded welcome messages for new users
- **Template System**: HTML email templates with GlycoFit branding
- **Error Handling**: Graceful failure handling for email issues

## Cloudinary Integration

Complete image management:

- **Avatar Uploads**: Automatic resizing and optimization
- **Document Storage**: Support for user document uploads
- **Image Deletion**: Cleanup when images are replaced
- **Signed URLs**: Direct upload capabilities for mobile apps

## Development Features

1. **Comprehensive Logging**:
   - All requests logged with sensitive data filtering
   - Database operations tracked
   - Authentication attempts monitored
   - Error logging with context

2. **CORS Configuration**:
   - Configured for Expo development
   - Local network support
   - Mobile app compatibility

3. **Error Handling**:
   - Proper HTTP status codes
   - Detailed error messages for development
   - Security considerations for production

## MongoDB Collections

- `users`: User accounts with Firebase UID references
- `user_info`: Extended user information and documents
- `glucose_readings`: Blood glucose measurements
- Additional collections can be added as needed

## Security Features

- **Firebase UID Validation**: Users linked to Firebase accounts
- **JWT Token Security**: Secure API access
- **Input Validation**: Comprehensive data validation
- **Sensitive Data Protection**: Passwords and secrets filtered from logs
- **File Upload Security**: Type validation and size limits

## Next Steps for Firebase Admin Integration

When you're ready to add Firebase Admin:

1. Install `firebase-admin` package
2. Create Firebase service initialization
3. Add token verification middleware
4. Integrate Firebase user management
5. Add push notification services

The current structure is ready for these additions!

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_URI` | MongoDB connection string | Yes |
| `PORT` | Server port | No (default: 5000) |
| `FLASK_ENV` | Environment mode | No (default: production) |
| `JWT_SECRET` | JWT signing key | Yes |
| `JWT_EXPIRES_TIME` | Token expiration | No (default: 24h) |
| `SMTP_HOST` | Email server host | Yes for email |
| `SMTP_PORT` | Email server port | Yes for email |
| `SMTP_EMAIL` | Email username | Yes for email |
| `SMTP_PASSWORD` | Email password | Yes for email |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes for images |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes for images |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes for images |
