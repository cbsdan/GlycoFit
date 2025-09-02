from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.logging_middleware import log_database_operation
import logging

class UserMeal:
    # Define valid meal types
    VALID_MEAL_TYPES = [
        'breakfast',
        'lunch', 
        'dinner',
        'snacks',
        'drinks',
        'dessert',
        'unlabeled',
        'other'
    ]
    
    def __init__(self, user_id, nutrients, image_url=None, image_public_id=None, meal_name=None, notes=None, food_type=None):
        self.user_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        self.nutrients = nutrients  # Dict with Calories, Protein (g), Carbs (g), Fat (g)
        self.image_url = image_url
        self.image_public_id = image_public_id
        self.meal_name = meal_name  # Optional meal name
        self.notes = notes  # Optional user notes
        self.food_type = self._validate_food_type(food_type)  # breakfast, lunch, dinner, snacks, drinks, etc.
        self.meal_datetime = datetime.utcnow()  # When the meal was recorded
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def _validate_food_type(self, food_type):
        """Validate and normalize food type"""
        if food_type is None:
            return 'other'  # Default to 'other' if not specified
        
        food_type_lower = food_type.lower().strip()
        if food_type_lower in self.VALID_MEAL_TYPES:
            return food_type_lower
        else:
            logging.warning(f"Invalid food type '{food_type}', defaulting to 'other'")
            return 'other'

    def to_dict(self):
        """Convert meal object to dictionary for MongoDB storage"""
        return {
            'user_id': self.user_id,
            'nutrients': self.nutrients,
            'image_url': self.image_url,
            'image_public_id': self.image_public_id,
            'meal_name': self.meal_name,
            'notes': self.notes,
            'food_type': self.food_type,
            'meal_datetime': self.meal_datetime,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @staticmethod
    def create_meal(user_id, nutrients, image_url=None, image_public_id=None, meal_name=None, notes=None, food_type=None):
        """Create a new meal record"""
        try:
            db = get_db()
            
            meal = UserMeal(
                user_id=user_id,
                nutrients=nutrients,
                image_url=image_url,
                image_public_id=image_public_id,
                meal_name=meal_name,
                notes=notes,
                food_type=food_type
            )
            
            result = db.user_meals.insert_one(meal.to_dict())
            log_database_operation('insert_one', 'user_meals', meal.to_dict(), result)
            
            logging.info(f"Meal created successfully for user {user_id}: {result.inserted_id}")
            
            return {
                'success': True,
                'meal_id': str(result.inserted_id),
                'meal': meal.to_dict()
            }
            
        except Exception as e:
            logging.error(f"Error creating meal for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_user_meals(user_id, limit=50, offset=0, start_date=None, end_date=None):
        """Get meals for a specific user"""
        try:
            db = get_db()
            
            # Build query
            query = {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id}
            
            if start_date or end_date:
                date_query = {}
                if start_date:
                    if isinstance(start_date, str):
                        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    date_query['$gte'] = start_date
                if end_date:
                    if isinstance(end_date, str):
                        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    date_query['$lte'] = end_date
                query['meal_datetime'] = date_query
            
            # Get meals
            meals = list(db.user_meals.find(query)
                        .sort('meal_datetime', -1)
                        .skip(offset)
                        .limit(limit))
            
            log_database_operation('find', 'user_meals', query, meals)
            
            # Format response
            meals_response = []
            for meal in meals:
                meal_data = {
                    'id': str(meal['_id']),
                    'user_id': str(meal['user_id']),
                    'nutrients': meal['nutrients'],
                    'image_url': meal.get('image_url'),
                    'image_public_id': meal.get('image_public_id'),
                    'meal_name': meal.get('meal_name'),
                    'notes': meal.get('notes'),
                    'food_type': meal.get('food_type', 'other'),
                    'meal_datetime': meal['meal_datetime'].isoformat(),
                    'created_at': meal['created_at'].isoformat(),
                    'updated_at': meal['updated_at'].isoformat()
                }
                meals_response.append(meal_data)
            
            return {
                'success': True,
                'meals': meals_response,
                'count': len(meals_response)
            }
            
        except Exception as e:
            logging.error(f"Error getting meals for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_meal_by_id(meal_id, user_id=None):
        """Get a specific meal by ID"""
        try:
            db = get_db()
            
            query = {'_id': ObjectId(meal_id)}
            if user_id:
                query['user_id'] = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            meal = db.user_meals.find_one(query)
            log_database_operation('find_one', 'user_meals', query, meal)
            
            if meal:
                meal_data = {
                    'id': str(meal['_id']),
                    'user_id': str(meal['user_id']),
                    'nutrients': meal['nutrients'],
                    'image_url': meal.get('image_url'),
                    'image_public_id': meal.get('image_public_id'),
                    'meal_name': meal.get('meal_name'),
                    'notes': meal.get('notes'),
                    'food_type': meal.get('food_type', 'other'),
                    'meal_datetime': meal['meal_datetime'].isoformat(),
                    'created_at': meal['created_at'].isoformat(),
                    'updated_at': meal['updated_at'].isoformat()
                }
                
                return {
                    'success': True,
                    'meal': meal_data
                }
            else:
                return {
                    'success': False,
                    'error': 'Meal not found'
                }
                
        except Exception as e:
            logging.error(f"Error getting meal {meal_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def update_meal(meal_id, user_id, meal_name=None, notes=None, food_type=None):
        """Update meal details (meal_name, notes, and food_type)"""
        try:
            db = get_db()
            
            update_data = {
                'updated_at': datetime.utcnow()
            }
            
            if meal_name is not None:
                update_data['meal_name'] = meal_name
            if notes is not None:
                update_data['notes'] = notes
            if food_type is not None:
                # Validate food_type
                valid_types = UserMeal.VALID_MEAL_TYPES
                food_type_lower = food_type.lower().strip()
                if food_type_lower in valid_types:
                    update_data['food_type'] = food_type_lower
                else:
                    logging.warning(f"Invalid food type '{food_type}', not updating")
                    # Don't update food_type if invalid
            
            query = {
                '_id': ObjectId(meal_id),
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id
            }
            
            result = db.user_meals.update_one(query, {'$set': update_data})
            log_database_operation('update_one', 'user_meals', query, result)
            
            if result.modified_count > 0:
                return {
                    'success': True,
                    'message': 'Meal updated successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Meal not found or no changes made'
                }
                
        except Exception as e:
            logging.error(f"Error updating meal {meal_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def delete_meal(meal_id, user_id):
        """Delete a meal record"""
        try:
            db = get_db()
            
            # First get the meal to check if it has an image to delete from Cloudinary
            meal = db.user_meals.find_one({
                '_id': ObjectId(meal_id),
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id
            })
            
            if not meal:
                return {
                    'success': False,
                    'error': 'Meal not found'
                }
            
            # Delete from database
            result = db.user_meals.delete_one({
                '_id': ObjectId(meal_id),
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id
            })
            
            log_database_operation('delete_one', 'user_meals', {'_id': ObjectId(meal_id)}, result)
            
            if result.deleted_count > 0:
                # Return image public_id so it can be deleted from Cloudinary by the caller
                return {
                    'success': True,
                    'message': 'Meal deleted successfully',
                    'image_public_id': meal.get('image_public_id')
                }
            else:
                return {
                    'success': False,
                    'error': 'Meal not found'
                }
                
        except Exception as e:
            logging.error(f"Error deleting meal {meal_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_nutrition_summary(user_id, start_date=None, end_date=None):
        """Get nutrition summary for a user within a date range"""
        try:
            db = get_db()
            
            # Build match stage for aggregation
            match_stage = {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id}
            
            if start_date or end_date:
                date_query = {}
                if start_date:
                    if isinstance(start_date, str):
                        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    date_query['$gte'] = start_date
                if end_date:
                    if isinstance(end_date, str):
                        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    date_query['$lte'] = end_date
                match_stage['meal_datetime'] = date_query
            
            pipeline = [
                {'$match': match_stage},
                {
                    '$group': {
                        '_id': None,
                        'total_calories': {'$sum': '$nutrients.Calories'},
                        'total_protein': {'$sum': '$nutrients.Protein (g)'},
                        'total_carbs': {'$sum': '$nutrients.Carbs (g)'},
                        'total_fat': {'$sum': '$nutrients.Fat (g)'},
                        'meal_count': {'$sum': 1},
                        'avg_calories': {'$avg': '$nutrients.Calories'},
                        'avg_protein': {'$avg': '$nutrients.Protein (g)'},
                        'avg_carbs': {'$avg': '$nutrients.Carbs (g)'},
                        'avg_fat': {'$avg': '$nutrients.Fat (g)'}
                    }
                }
            ]
            
            result = list(db.user_meals.aggregate(pipeline))
            
            if result:
                summary = result[0]
                return {
                    'success': True,
                    'summary': {
                        'total_nutrients': {
                            'calories': round(summary.get('total_calories', 0), 2),
                            'protein': round(summary.get('total_protein', 0), 2),
                            'carbs': round(summary.get('total_carbs', 0), 2),
                            'fat': round(summary.get('total_fat', 0), 2)
                        },
                        'average_nutrients': {
                            'calories': round(summary.get('avg_calories', 0), 2),
                            'protein': round(summary.get('avg_protein', 0), 2),
                            'carbs': round(summary.get('avg_carbs', 0), 2),
                            'fat': round(summary.get('avg_fat', 0), 2)
                        },
                        'meal_count': summary.get('meal_count', 0)
                    }
                }
            else:
                return {
                    'success': True,
                    'summary': {
                        'total_nutrients': {'calories': 0, 'protein': 0, 'carbs': 0, 'fat': 0},
                        'average_nutrients': {'calories': 0, 'protein': 0, 'carbs': 0, 'fat': 0},
                        'meal_count': 0
                    }
                }
                
        except Exception as e:
            logging.error(f"Error getting nutrition summary for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_meals_by_food_type(user_id, food_type, limit=50, offset=0, start_date=None, end_date=None):
        """Get meals for a specific user filtered by food type"""
        try:
            db = get_db()
            
            # Validate food_type
            if food_type.lower() not in UserMeal.VALID_MEAL_TYPES:
                return {
                    'success': False,
                    'error': f'Invalid food type. Valid types: {", ".join(UserMeal.VALID_MEAL_TYPES)}'
                }
            
            # Build query
            query = {
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                'food_type': food_type.lower()
            }
            
            if start_date or end_date:
                date_query = {}
                if start_date:
                    if isinstance(start_date, str):
                        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    date_query['$gte'] = start_date
                if end_date:
                    if isinstance(end_date, str):
                        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    date_query['$lte'] = end_date
                query['meal_datetime'] = date_query
            
            # Get meals
            meals = list(db.user_meals.find(query)
                        .sort('meal_datetime', -1)
                        .skip(offset)
                        .limit(limit))
            
            log_database_operation('find', 'user_meals', query, meals)
            
            # Format response
            meals_response = []
            for meal in meals:
                meal_data = {
                    'id': str(meal['_id']),
                    'user_id': str(meal['user_id']),
                    'nutrients': meal['nutrients'],
                    'image_url': meal.get('image_url'),
                    'image_public_id': meal.get('image_public_id'),
                    'meal_name': meal.get('meal_name'),
                    'notes': meal.get('notes'),
                    'food_type': meal.get('food_type', 'other'),
                    'meal_datetime': meal['meal_datetime'].isoformat(),
                    'created_at': meal['created_at'].isoformat(),
                    'updated_at': meal['updated_at'].isoformat()
                }
                meals_response.append(meal_data)
            
            return {
                'success': True,
                'meals': meals_response,
                'count': len(meals_response),
                'food_type': food_type.lower()
            }
            
        except Exception as e:
            logging.error(f"Error getting meals by food type for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_food_type_summary(user_id, start_date=None, end_date=None):
        """Get nutrition summary grouped by food type"""
        try:
            db = get_db()
            
            # Build match stage for aggregation
            match_stage = {'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id}
            
            if start_date or end_date:
                date_query = {}
                if start_date:
                    if isinstance(start_date, str):
                        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    date_query['$gte'] = start_date
                if end_date:
                    if isinstance(end_date, str):
                        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    date_query['$lte'] = end_date
                match_stage['meal_datetime'] = date_query
            
            pipeline = [
                {'$match': match_stage},
                {
                    '$group': {
                        '_id': '$food_type',
                        'total_calories': {'$sum': '$nutrients.Calories'},
                        'total_protein': {'$sum': '$nutrients.Protein (g)'},
                        'total_carbs': {'$sum': '$nutrients.Carbs (g)'},
                        'total_fat': {'$sum': '$nutrients.Fat (g)'},
                        'meal_count': {'$sum': 1},
                        'avg_calories': {'$avg': '$nutrients.Calories'},
                        'avg_protein': {'$avg': '$nutrients.Protein (g)'},
                        'avg_carbs': {'$avg': '$nutrients.Carbs (g)'},
                        'avg_fat': {'$avg': '$nutrients.Fat (g)'}
                    }
                },
                {'$sort': {'meal_count': -1}}  # Sort by meal count descending
            ]
            
            result = list(db.user_meals.aggregate(pipeline))
            
            summary_by_type = {}
            for item in result:
                food_type = item['_id'] or 'other'
                summary_by_type[food_type] = {
                    'total_nutrients': {
                        'calories': round(item.get('total_calories', 0), 2),
                        'protein': round(item.get('total_protein', 0), 2),
                        'carbs': round(item.get('total_carbs', 0), 2),
                        'fat': round(item.get('total_fat', 0), 2)
                    },
                    'average_nutrients': {
                        'calories': round(item.get('avg_calories', 0), 2),
                        'protein': round(item.get('avg_protein', 0), 2),
                        'carbs': round(item.get('avg_carbs', 0), 2),
                        'fat': round(item.get('avg_fat', 0), 2)
                    },
                    'meal_count': item.get('meal_count', 0)
                }
            
            return {
                'success': True,
                'summary_by_food_type': summary_by_type
            }
                
        except Exception as e:
            logging.error(f"Error getting food type summary for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
