from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class DisableRecord:
    def __init__(self, reason, end_date=None, is_permanent=False):
        self.start_date = datetime.utcnow()
        self.end_date = end_date
        self.reason = reason
        self.is_permanent = is_permanent
        self.is_active = True
        self.created_at = datetime.utcnow()

    def to_dict(self):
        return {
            'start_date': self.start_date,
            'end_date': self.end_date,
            'reason': self.reason,
            'is_permanent': self.is_permanent,
            'is_active': self.is_active,
            'created_at': self.created_at
        }

class User:
    def __init__(self, uid, first_name, last_name, email, avatar=None, role='user'):
        self.uid = uid
        self.first_name = first_name
        self.last_name = last_name
        self.email = email.lower().strip()
        self.role = role
        self.avatar = avatar or {'public_id': None, 'url': None}
        self.push_tokens = []
        self.enable_push_notifications = True
        self.permission_token = None
        self.multi_factor_enabled = False
        self.disable_history = []
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        """Convert user object to dictionary for MongoDB storage"""
        return {
            'uid': self.uid,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'role': self.role,
            'avatar': self.avatar,
            'push_tokens': self.push_tokens,
            'enable_push_notifications': self.enable_push_notifications,
            'permission_token': self.permission_token,
            'multi_factor_enabled': self.multi_factor_enabled,
            'disable_history': self.disable_history,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create User object from MongoDB document"""
        user = cls(
            uid=data['uid'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            avatar=data.get('avatar', {'public_id': None, 'url': None}),
            role=data.get('role', 'user')
        )
        user.push_tokens = data.get('push_tokens', [])
        user.enable_push_notifications = data.get('enable_push_notifications', True)
        user.permission_token = data.get('permission_token')
        user.multi_factor_enabled = data.get('multi_factor_enabled', False)
        user.disable_history = data.get('disable_history', [])
        user.created_at = data.get('created_at', datetime.utcnow())
        user.updated_at = data.get('updated_at', datetime.utcnow())
        return user

    def is_currently_disabled(self):
        """Check if user is currently disabled"""
        if not self.disable_history:
            return False

        now = datetime.utcnow()

        # Check if any active disable record is currently in effect
        for record in self.disable_history:
            if not record.get('is_active', False):
                continue

            # If permanent, user is disabled
            if record.get('is_permanent', False):
                return True

            # If not permanent, check if current date is before end date
            end_date = record.get('end_date')
            if end_date and end_date > now:
                return True

        return False

    def get_current_disable_record(self):
        """Get current active disable record if any"""
        if not self.disable_history:
            return None

        now = datetime.utcnow()

        # Find the active disable record
        for record in self.disable_history:
            if not record.get('is_active', False):
                continue

            if record.get('is_permanent', False):
                return record

            end_date = record.get('end_date')
            if end_date and end_date > now:
                return record

        return None

    def add_disable_record(self, reason, end_date=None, is_permanent=False):
        """Add a new disable record and deactivate previous ones"""
        # First deactivate any current active records
        for record in self.disable_history:
            if record.get('is_active', False):
                record['is_active'] = False

        # Create new disable record
        new_record = DisableRecord(reason, end_date, is_permanent)
        self.disable_history.append(new_record.to_dict())
        self.updated_at = datetime.utcnow()

        return new_record

    def enable_user(self, reason="User enabled"):
        """Enable user by deactivating all disable records"""
        for record in self.disable_history:
            if record.get('is_active', False):
                record['is_active'] = False
                record['end_date'] = datetime.utcnow()  # Set end date to now

        # Add an enable record for audit trail
        enable_record = {
            'start_date': datetime.utcnow(),
            'end_date': None,
            'reason': reason,
            'is_permanent': False,
            'is_active': False,  # Enable records are not "active" disable records
            'action': 'enabled',
            'created_at': datetime.utcnow()
        }
        self.disable_history.append(enable_record)
        self.updated_at = datetime.utcnow()

    def save(self):
        """Save user to database"""
        try:
            db = get_db()
            user_data = self.to_dict()

            if hasattr(self, '_id'):
                # Update existing user
                result = db.users.update_one(
                    {'_id': self._id},
                    {'$set': user_data}
                )
                log_database_operation('update_one', 'users', {'_id': self._id}, result)
                return result
            else:
                # Create new user
                result = db.users.insert_one(user_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'users', user_data, result)
                return result

        except Exception as e:
            logging.error(f"Error saving user: {str(e)}")
            raise e

    @staticmethod
    def find_by_uid(uid):
        """Find user by Firebase UID"""
        try:
            db = get_db()
            user_data = db.users.find_one({'uid': uid})
            log_database_operation('find_one', 'users', {'uid': uid}, user_data)

            if user_data:
                user = User.from_dict(user_data)
                user._id = user_data['_id']
                return user
            return None

        except Exception as e:
            logging.error(f"Error finding user by UID: {str(e)}")
            raise e

    @staticmethod
    def find_by_email(email):
        """Find user by email"""
        try:
            db = get_db()
            user_data = db.users.find_one({'email': email.lower().strip()})
            log_database_operation('find_one', 'users', {'email': email}, user_data)

            if user_data:
                user = User.from_dict(user_data)
                user._id = user_data['_id']
                return user
            return None

        except Exception as e:
            logging.error(f"Error finding user by email: {str(e)}")
            raise e

    @staticmethod
    def find_by_id(user_id):
        """Find user by MongoDB ObjectId"""
        try:
            db = get_db()
            user_data = db.users.find_one({'_id': ObjectId(user_id)})
            log_database_operation('find_one', 'users', {'_id': user_id}, user_data)

            if user_data:
                user = User.from_dict(user_data)
                user._id = user_data['_id']
                return user
            return None

        except Exception as e:
            logging.error(f"Error finding user by ID: {str(e)}")
            raise e

    @staticmethod
    def get_all_users(skip=0, limit=50):
        """Get all users with pagination"""
        try:
            db = get_db()
            users_data = list(db.users.find().skip(skip).limit(limit))
            log_database_operation('find', 'users', {'skip': skip, 'limit': limit}, users_data)

            users = []
            for user_data in users_data:
                user = User.from_dict(user_data)
                user._id = user_data['_id']
                users.append(user)

            return users

        except Exception as e:
            logging.error(f"Error getting all users: {str(e)}")
            raise e

    def add_push_token(self, token):
        """Add push notification token"""
        if token not in self.push_tokens:
            self.push_tokens.append(token)
            self.updated_at = datetime.utcnow()

    def remove_push_token(self, token):
        """Remove push notification token"""
        if token in self.push_tokens:
            self.push_tokens.remove(token)
            self.updated_at = datetime.utcnow()

    def update_profile(self, **kwargs):
        """Update user profile fields"""
        allowed_fields = ['first_name', 'last_name', 'avatar', 'enable_push_notifications', 'permission_token']
        
        for field, value in kwargs.items():
            if field in allowed_fields:
                setattr(self, field, value)
        
        self.updated_at = datetime.utcnow()

    def to_safe_dict(self):
        """Return user data without sensitive information"""
        return {
            'id': str(getattr(self, '_id', '')),
            'uid': self.uid,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'role': self.role,
            'avatar': self.avatar,
            'enable_push_notifications': self.enable_push_notifications,
            'multi_factor_enabled': self.multi_factor_enabled,
            'is_disabled': self.is_currently_disabled(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
