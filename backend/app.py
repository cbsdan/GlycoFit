from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from waitress import serve
import os
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Import custom modules
from config.database import init_db
from config.firebase_admin import init_firebase
from middleware.logging_middleware import setup_logging, log_request
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.nutrient_routes import nutrient_bp
from routes.gemini_routes import gemini_bp
from routes.admin_routes import admin_bp
from routes.physician_routes import physician_bp
from routes.activity_routes import activity_bp
from routes.health_data_routes import health_data_bp
from routes.diabetes_assessment_routes import diabetes_assessment_bp
from routes.chat_routes import chat_bp
from routes.chatbot_routes import chatbot_bp
from routes.smoking_intake_routes import smoking_tracking_bp
from routes.alcohol_intake_routes import alcohol_intake_bp
from routes.sleep_tracking_routes import sleep_tracking_bp
from routes.food_risk_routes import food_risk_bp
from routes.step_tracking_routes import step_tracking_bp
from routes.lifestyle_routes import lifestyle_bp
from routes.overall_risk_routes import overall_risk_bp
from controllers.chat_controller import register_socket_events
from services.email_service import init_mail
from services.cloudinary_service import init_cloudinary
from services.ml_service import init_ml_service
from services.gemini_service import init_gemini_service
from services.groq_service import init_groq_service
from services.diabetes_service import init_diabetes_service
from models.chatbot_message import ChatbotMessage
from controllers.sleep_tracking_controller import init_sleep_tracking_indexes
from controllers.alcohol_intake_controller import init_alcohol_tracking_indexes
from controllers.smoking_tracking_controller import init_smoking_tracking_indexes
from controllers.overall_risk_controller import init_overall_risk_indexes

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-this')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'jwt-secret-change-this')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)  # Changed to 7 days like your .env
    app.config['JWT_TOKEN_LOCATION'] = ['headers']  # Look for JWT in Authorization header
    app.config['JWT_HEADER_NAME'] = 'Authorization'  # Header name to look for JWT
    app.config['JWT_HEADER_TYPE'] = 'Bearer'  # Expected token type in header
    app.config['DB_URI'] = os.getenv('DB_URI', 'mongodb://localhost:27017/glycofit')
    
    # File upload configuration
    app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size
    app.config['UPLOAD_FOLDER'] = 'uploads'
    
    # CORS Configuration
    CORS(app, origins=[
        "exp://192.168.*.*:*",  # Expo development
        "http://localhost:*",   # Local development
        "https://localhost:*",  # Local HTTPS
        "https://localhost:3000",  # Local HTTPS
        "capacitor://localhost", # Capacitor apps
        "ionic://localhost",    # Ionic apps
        "http://192.168.*.*:*", # Local network
        "https://192.168.*.*:*", # Local network HTTPS
        "https://glycofit.vercel.app"
    ], supports_credentials=True)
    
    # Initialize JWT Manager
    jwt = JWTManager(app)
    
    # Setup logging
    setup_logging()
    
    # Initialize database
    init_db(app)
    
    # Initialize email service
    try:
        init_mail(app)
        logging.info("Email service initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize email service: {str(e)}")
    
    # Initialize Cloudinary
    try:
        init_cloudinary()
        logging.info("Cloudinary service initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Cloudinary: {str(e)}")
    
    # Initialize Firebase Admin (fast initialization)
    try:
        init_firebase()
        logging.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Firebase Admin SDK: {str(e)}")
        logging.warning("Firebase features will be disabled")
    
    # Initialize Gemini AI Service (fast initialization)
    try:
        init_gemini_service()
        logging.info("Gemini AI Service initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Gemini AI Service: {str(e)}")
        logging.warning("Gemini AI features will be disabled")
    
    # Initialize Groq Service for Chatbot
    try:
        init_groq_service()
        logging.info("Groq Service initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Groq Service: {str(e)}")
        logging.warning("Chatbot features will be disabled")
    
    # Initialize Chatbot Message Model Indexes
    try:
        ChatbotMessage.ensure_indexes()
        logging.info("Chatbot message database indexes created successfully")
    except Exception as e:
        logging.error(f"Failed to create chatbot message indexes: {str(e)}")
        logging.warning("Chatbot message queries may be slower without indexes")
    
    # Initialize Diabetes Prediction Service
    try:
        init_diabetes_service()
        logging.info("Diabetes Prediction Service initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Diabetes Prediction Service: {str(e)}")
        logging.warning("Diabetes prediction features will be disabled")
    
    # Initialize Sleep Tracking Indexes
    try:
        init_sleep_tracking_indexes()
        logging.info("Sleep tracking database indexes created successfully")
    except Exception as e:
        logging.error(f"Failed to create sleep tracking indexes: {str(e)}")
        logging.warning("Sleep tracking queries may be slower without indexes")
    
    # Initialize Alcohol Tracking Indexes
    try:
        init_alcohol_tracking_indexes()
        logging.info("Alcohol tracking database indexes created successfully")
    except Exception as e:
        logging.error(f"Failed to create alcohol tracking indexes: {str(e)}")
        logging.warning("Alcohol tracking queries may be slower without indexes")
    
    # Initialize Smoking Tracking Indexes
    try:
        init_smoking_tracking_indexes()
        logging.info("Smoking tracking database indexes created successfully")
    except Exception as e:
        logging.error(f"Failed to create smoking tracking indexes: {str(e)}")
        logging.warning("Smoking tracking queries may be slower without indexes")
    
    # Initialize Overall Risk Assessment Indexes
    try:
        init_overall_risk_indexes()
        logging.info("Overall risk assessment database indexes created successfully")
    except Exception as e:
        logging.error(f"Failed to create overall risk assessment indexes: {str(e)}")
        logging.warning("Overall risk assessment queries may be slower without indexes")
    
    # Defer ML Service initialization to avoid blocking startup
    # The ML service will initialize lazily on first use
    logging.info("ML Service will initialize on first use (lazy loading)")
    
    # Middleware for request logging
    @app.before_request
    def before_request():
        log_request()
    
    @app.after_request
    def after_request(response):
        logging.info(f"Response Status: {response.status_code}")
        if response.status_code >= 400:
            logging.error(f"Error Response: {response.get_data(as_text=True)}")
        return response
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
    app.register_blueprint(user_bp, url_prefix='/api/v1/users')
    app.register_blueprint(nutrient_bp, url_prefix='/api/v1/nutrients')
    app.register_blueprint(gemini_bp, url_prefix='/api/v1/gemini')
    app.register_blueprint(admin_bp, url_prefix='/api/v1/admin')
    app.register_blueprint(physician_bp, url_prefix='/api/v1/physician')
    app.register_blueprint(activity_bp, url_prefix='/api/v1/activity')
    app.register_blueprint(health_data_bp, url_prefix='/api/v1/health-data')
    app.register_blueprint(diabetes_assessment_bp, url_prefix='/api/v1/diabetes-assessment')
    app.register_blueprint(chat_bp, url_prefix='/api/v1/chat')
    app.register_blueprint(chatbot_bp, url_prefix='/api/v1/chatbot')
    app.register_blueprint(smoking_tracking_bp, url_prefix='/api/v1/smoking-tracking')
    app.register_blueprint(alcohol_intake_bp, url_prefix='/api/v1/alcohol-intake')
    app.register_blueprint(sleep_tracking_bp, url_prefix='/api/v1/sleep-tracking')
    app.register_blueprint(step_tracking_bp, url_prefix='/api/v1/step-tracking')  # ← ADD THIS
    app.register_blueprint(food_risk_bp, url_prefix='/api/v1/food-risk')
    app.register_blueprint(overall_risk_bp, url_prefix='/api/v1/risk-assessment')
    app.register_blueprint(lifestyle_bp)  # Lifestyle recommendations - uses its own prefix

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        logging.info("Health check endpoint accessed")
        
        # Check ML service status (without triggering initialization)
        ml_status = 'disabled'
        try:
            from services.ml_service import ml_service, ml_service_initialized, ml_service_initializing
            if ml_service_initializing:
                ml_status = 'initializing'
            elif ml_service_initialized and ml_service and ml_service.is_model_ready():
                ml_status = 'ready'
            elif ml_service_initialized:
                ml_status = 'error'
            else:
                ml_status = 'lazy_load_pending'
        except Exception:
            ml_status = 'error'
        
        # Check Gemini service status
        gemini_status = 'disabled'
        try:
            from services.gemini_service import get_gemini_service
            gemini_service = get_gemini_service()
            if gemini_service and gemini_service.is_ready():
                gemini_status = 'ready'
            else:
                gemini_status = 'not_ready'
        except Exception:
            gemini_status = 'error'
        
        return jsonify({
            'status': 'healthy',
            'message': 'GlycoFit Backend is running',
            'timestamp': datetime.utcnow().isoformat(),
            'services': {
                'database': 'connected',
                'email': 'configured',
                'cloudinary': 'configured',
                'firebase': 'configured',
                'ml_model': ml_status,
                'gemini_ai': gemini_status
            }
        }), 200
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        logging.warning(f"404 Error: {request.url} not found")
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        logging.error(f"500 Error: {str(error)}")
        return jsonify({'error': 'Internal server error'}), 500
    
    @app.errorhandler(413)
    def too_large(error):
        logging.warning("413 Error: File too large")
        return jsonify({'error': 'File too large'}), 413
    
    return app

# Initialize SocketIO globally
socketio = None

def create_socketio(app):
    """Create and configure SocketIO instance"""
    global socketio
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode='threading',
        logger=True,
        engineio_logger=True
    )
    # Register socket events
    register_socket_events(socketio)
    return socketio

if __name__ == '__main__':
    app = create_app()
    socketio = create_socketio(app)
    port = int(os.getenv('PORT', 5000))

    debug = False  # force OFF

    logging.info(f"Starting GlycoFit Backend on port {port}")
    logging.info(f"Debug mode: {debug}")
    logging.info("Socket.IO enabled for real-time chat")

    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=False,
        use_reloader=False,
        allow_unsafe_werkzeug=True
    )
