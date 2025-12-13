from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_socketio import SocketIO
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
from routes.health_data_routes import health_data_bp
from routes.diabetes_assessment_routes import diabetes_assessment_bp
from routes.chat_routes import chat_bp
from controllers.chat_controller import register_socket_events
from services.email_service import init_mail
from services.cloudinary_service import init_cloudinary
from services.ml_service import init_ml_service
from services.gemini_service import init_gemini_service
from services.diabetes_service import init_diabetes_service

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-this')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'jwt-secret-change-this')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)  # Changed to 7 days like your .env
    app.config['DB_URI'] = os.getenv('DB_URI', 'mongodb://localhost:27017/glycofit')
    
    # File upload configuration
    app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size
    app.config['UPLOAD_FOLDER'] = 'uploads'
    
    # CORS Configuration - Allow your mobile app and any localhost for development
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
    
    # Initialize Diabetes Prediction Service
    try:
        init_diabetes_service()
        logging.info("Diabetes Prediction Service initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Diabetes Prediction Service: {str(e)}")
        logging.warning("Diabetes prediction features will be disabled")
    
    # Defer ML Service initialization to avoid blocking startup
    # The ML service will initialize lazily on first use
    logging.info("ML Service will initialize on first use (lazy loading)")
    
    # Middleware for request logging
    @app.before_request
    def before_request():
        log_request()
    
    @app.after_request
    def after_request(response):
        # Log response details
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
    app.register_blueprint(health_data_bp, url_prefix='/api/v1/health-data')
    app.register_blueprint(diabetes_assessment_bp, url_prefix='/api/v1/diabetes-assessment')
    app.register_blueprint(chat_bp, url_prefix='/api/v1/chat')

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
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logging.info(f"Starting GlycoFit Backend on port {port}")
    logging.info(f"Debug mode: {debug}")
    logging.info("Socket.IO enabled for real-time chat")

    # Use SocketIO's run method instead of waitress for WebSocket support
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
