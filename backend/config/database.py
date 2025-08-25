from pymongo import MongoClient
from flask import current_app
import logging

# Global database connection
db = None
client = None

def init_db(app):
    """Initialize MongoDB connection"""
    global db, client
    
    try:
        mongodb_uri = app.config['DB_URI']
        logging.info(f"Connecting to MongoDB: {mongodb_uri.split('@')[-1] if '@' in mongodb_uri else mongodb_uri}")
        
        client = MongoClient(mongodb_uri)
        
        # Extract database name from URI or use default
        if mongodb_uri.endswith('/'):
            db_name = 'glycofit'
        else:
            db_name = mongodb_uri.split('/')[-1].split('?')[0] or 'glycofit'
        
        db = client[db_name]
        
        # Test the connection
        client.admin.command('ping')
        logging.info("Successfully connected to MongoDB")
        
        # Create indexes for better performance
        create_indexes()
        
    except Exception as e:
        logging.error(f"Failed to connect to MongoDB: {str(e)}")
        raise e

def create_indexes():
    """Create database indexes for better performance"""
    try:
        # User collection indexes
        db.users.create_index("email", unique=True)
        db.users.create_index("username", unique=True)
        
        # Glucose readings indexes
        db.glucose_readings.create_index([("user_id", 1), ("timestamp", -1)])
        
        # Meals indexes
        db.meals.create_index([("user_id", 1), ("date", -1)])
        
        logging.info("Database indexes created successfully")
        
    except Exception as e:
        logging.warning(f"Error creating indexes: {str(e)}")

def get_db():
    """Get database connection"""
    global db
    if db is None:
        logging.error("Database not initialized")
        raise Exception("Database connection not established")
    return db

def close_db():
    """Close database connection"""
    global client
    if client:
        client.close()
        logging.info("Database connection closed")
