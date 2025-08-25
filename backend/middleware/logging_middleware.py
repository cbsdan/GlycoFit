import logging
import os
from datetime import datetime
from flask import request, g
import json
from bson import ObjectId

def datetime_serializer(obj):
    """JSON serializer for datetime and ObjectId objects"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def safe_json_dumps(data, **kwargs):
    """Safely serialize data to JSON with datetime support"""
    return json.dumps(data, default=datetime_serializer, **kwargs)

def setup_logging():
    """Setup logging configuration"""
    # Create logs directory if it doesn't exist
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    # Configure logging
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_file = os.getenv('LOG_FILE', 'logs/app.log')
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler()  # Console output
        ]
    )
    
    # Set specific logger levels
    logging.getLogger('werkzeug').setLevel(logging.WARNING)  # Reduce Flask request logs
    logging.getLogger('pymongo').setLevel(logging.WARNING)   # Reduce MongoDB logs
    
    logging.info("Logging system initialized")

def log_request():
    """Log incoming request details"""
    start_time = datetime.utcnow()
    g.start_time = start_time
    
    # Log request details
    request_data = {
        'timestamp': start_time.isoformat(),
        'method': request.method,
        'url': request.url,
        'path': request.path,
        'remote_addr': request.remote_addr,
        'user_agent': str(request.user_agent),
        'headers': dict(request.headers),
        'args': dict(request.args),
    }
    
    # Log request body for POST/PUT requests (be careful with sensitive data)
    if request.method in ['POST', 'PUT', 'PATCH']:
        try:
            if request.is_json:
                body = request.get_json()
                # Remove sensitive fields from logging
                if body and isinstance(body, dict):
                    safe_body = {k: v for k, v in body.items() 
                               if k.lower() not in ['password', 'token', 'secret']}
                    request_data['body'] = safe_body
            elif request.form:
                # Log form data (excluding sensitive fields)
                safe_form = {k: v for k, v in request.form.items() 
                           if k.lower() not in ['password', 'token', 'secret']}
                request_data['form'] = safe_form
        except Exception as e:
            logging.warning(f"Could not log request body: {str(e)}")
    
    # Log the request
    logging.info(f"Incoming Request: {safe_json_dumps(request_data, indent=2)}")

def log_database_operation(operation, collection, query=None, result=None):
    """Log database operations for debugging"""
    log_data = {
        'operation': operation,
        'collection': collection,
        'timestamp': datetime.utcnow().isoformat(),
    }
    
    if query:
        # Remove sensitive data from query logging
        safe_query = query.copy() if isinstance(query, dict) else query
        if isinstance(safe_query, dict):
            for key in ['password', 'token', 'secret']:
                if key in safe_query:
                    safe_query[key] = '[HIDDEN]'
        log_data['query'] = safe_query
    
    if result is not None:
        if hasattr(result, 'acknowledged'):
            log_data['result'] = {
                'acknowledged': result.acknowledged,
                'inserted_id': str(result.inserted_id) if hasattr(result, 'inserted_id') else None,
                'modified_count': getattr(result, 'modified_count', None),
                'deleted_count': getattr(result, 'deleted_count', None),
            }
        else:
            log_data['result_count'] = len(result) if hasattr(result, '__len__') else 1
    
    logging.info(f"Database Operation: {safe_json_dumps(log_data, indent=2)}")

def log_authentication_attempt(email, success, reason=None):
    """Log authentication attempts for security monitoring"""
    log_data = {
        'event': 'authentication_attempt',
        'email': email,
        'success': success,
        'timestamp': datetime.utcnow().isoformat(),
        'ip_address': request.remote_addr if request else 'unknown',
        'user_agent': str(request.user_agent) if request else 'unknown'
    }
    
    if reason:
        log_data['reason'] = reason
    
    if success:
        logging.info(f"Successful Authentication: {safe_json_dumps(log_data, indent=2)}")
    else:
        logging.warning(f"Failed Authentication: {safe_json_dumps(log_data, indent=2)}")

def log_error(error, context=None):
    """Log errors with context information"""
    log_data = {
        'event': 'error',
        'error': str(error),
        'timestamp': datetime.utcnow().isoformat(),
        'path': request.path if request else 'unknown',
        'method': request.method if request else 'unknown',
    }
    
    if context:
        log_data['context'] = context
    
    logging.error(f"Application Error: {safe_json_dumps(log_data, indent=2)}")
