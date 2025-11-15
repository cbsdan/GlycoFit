from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class UserMeal:
    def __init__(self, user_id, meal_name, date, nutrients=None, image_url=None, notes=None, food_type=None, meal_datetime=None):
        self.user_id = user_id
        self.meal_name = meal_name
        self.date = date
        self.nutrients = nutrients or {}
        self.image_url = image_url
        self.notes = notes
        self.food_type = food_type
        self.meal_datetime = meal_datetime
        self.created_at = datetime.utcnow()

    def to_dict(self):
        """Convert meal object to dictionary"""
        return {
            'user_id': self.user_id,
            'meal_name': self.meal_name,
            'date': self.date,
            'nutrients': self.nutrients,
            'image_url': self.image_url,
            'notes': self.notes,
            'food_type': self.food_type,
            'meal_datetime': self.meal_datetime,
            'created_at': self.created_at
        }

    @staticmethod
    def get_user_meals(user_id, skip=0, limit=100):
        """Get all meals for a user"""
        try:
            db = get_db()
            meals_data = list(
                db.user_meals.find({'user_id': ObjectId(user_id)})
                .sort('meal_datetime', -1)  # Prefer sorting by meal_datetime if available
                .skip(skip)
                .limit(limit)
            )
            log_database_operation('find', 'user_meals', {'user_id': user_id}, meals_data)
            
            meals = []
            for meal_data in meals_data:
                nutrients = meal_data.get('nutrients', {})
                date_val = meal_data.get('date', '')
                if isinstance(date_val, datetime):
                    date_val = date_val.isoformat()
                meal_datetime_val = meal_data.get('meal_datetime', '')
                if isinstance(meal_datetime_val, datetime):
                    meal_datetime_val = meal_datetime_val.isoformat()
                meal_dict = {
                    '_id': str(meal_data.get('_id', '')),
                    'user_id': str(meal_data.get('user_id', '')),
                    'meal_name': meal_data.get('meal_name', 'N/A'),
                    'date': date_val,
                    'meal_datetime': meal_datetime_val,
                    'nutrients': nutrients,
                    'calories': nutrients.get('Calories', ''),
                    'carbs': nutrients.get('Carbs (g)', ''),
                    'fat': nutrients.get('Fat (g)', ''),
                    'protein': nutrients.get('Protein (g)', ''),
                    'image_url': meal_data.get('image_url', ''),
                    'notes': meal_data.get('notes', ''),
                    'food_type': meal_data.get('food_type', ''),
                    'created_at': meal_data.get('created_at').isoformat() if isinstance(meal_data.get('created_at'), datetime) else meal_data.get('created_at', '')
                }
                meals.append(meal_dict)
            
            return {
                'success': True,
                'meals': meals,
                'count': len(meals)
            }
        except Exception as e:
            logging.error(f"Error getting user meals: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_meal_by_id(meal_id):
        """Get a specific meal by ID"""
        try:
            db = get_db()
            meal_data = db.user_meals.find_one({'_id': ObjectId(meal_id)})
            log_database_operation('find_one', 'user_meals', {'_id': meal_id}, meal_data)
            
            if meal_data:
                meal_data['_id'] = str(meal_data['_id'])
                meal_data['user_id'] = str(meal_data['user_id'])
                return meal_data
            return None
        except Exception as e:
            logging.error(f"Error getting meal: {str(e)}")
            raise e

    def save(self):
        """Save meal to database"""
        try:
            db = get_db()
            meal_data = self.to_dict()
            
            if hasattr(self, '_id'):
                result = db.user_meals.update_one(
                    {'_id': self._id},
                    {'$set': meal_data}
                )
                log_database_operation('update_one', 'user_meals', {'_id': self._id}, result)
            else:
                result = db.user_meals.insert_one(meal_data)
                self._id = result.inserted_id
                log_database_operation('insert_one', 'user_meals', meal_data, result)
            
            return result
        except Exception as e:
            logging.error(f"Error saving meal: {str(e)}")
            raise e

    @staticmethod
    def delete_meal(meal_id):
        """Delete a meal"""
        try:
            db = get_db()
            result = db.user_meals.delete_one({'_id': ObjectId(meal_id)})
            log_database_operation('delete_one', 'user_meals', {'_id': meal_id}, result)
            return result.deleted_count > 0
        except Exception as e:
            logging.error(f"Error deleting meal: {str(e)}")
            raise e
