from datetime import datetime
from config.database import get_db
import logging


class GeminiUsage:
    """
    Tracks daily Gemini API usage per (api_key_name, model_name).
    One document per (date, api_key_name, model_name) combination.
    Counts are global (shared across all users).
    """

    COLLECTION = 'gemini_usage'

    @staticmethod
    def ensure_indexes():
        """Create compound unique index for efficient lookups and atomic upserts."""
        try:
            db = get_db()
            db[GeminiUsage.COLLECTION].create_index(
                [('date', 1), ('api_key_name', 1), ('model_name', 1)],
                unique=True,
                name='date_key_model_unique'
            )
            logging.info("GeminiUsage indexes created successfully")
        except Exception as e:
            logging.error(f"Error creating GeminiUsage indexes: {str(e)}")

    @staticmethod
    def _today() -> str:
        """Return today's UTC date as YYYY-MM-DD string."""
        return datetime.utcnow().strftime('%Y-%m-%d')

    @staticmethod
    def get_count(date_str: str, api_key_name: str, model_name: str) -> int:
        """
        Get the current usage count for a given (date, api_key_name, model_name).

        Returns 0 if no document exists yet.
        """
        try:
            db = get_db()
            doc = db[GeminiUsage.COLLECTION].find_one(
                {'date': date_str, 'api_key_name': api_key_name, 'model_name': model_name},
                {'count': 1}
            )
            return doc['count'] if doc else 0
        except Exception as e:
            logging.error(f"GeminiUsage.get_count error: {str(e)}")
            return 0

    @staticmethod
    def increment(api_key_name: str, model_name: str) -> int:
        """
        Atomically increment the usage counter for today's (api_key_name, model_name).
        Creates the document if it does not exist yet.

        Returns the new count after incrementing.
        """
        try:
            db = get_db()
            date_str = GeminiUsage._today()
            result = db[GeminiUsage.COLLECTION].find_one_and_update(
                {'date': date_str, 'api_key_name': api_key_name, 'model_name': model_name},
                {
                    '$inc': {'count': 1},
                    '$setOnInsert': {'created_at': datetime.utcnow()}
                },
                upsert=True,
                return_document=True  # return the document AFTER the update
            )
            new_count = result['count'] if result else 1
            logging.info(
                f"Gemini usage incremented: {api_key_name}/{model_name} = {new_count}/day"
            )
            return new_count
        except Exception as e:
            logging.error(f"GeminiUsage.increment error: {str(e)}")
            return 0

    @staticmethod
    def get_all_usage(date_str: str = None) -> dict:
        """
        Return all usage counters for a given date (defaults to today).

        Returns a nested dict:
            {
                "GEMINI_API_KEY": {
                    "gemini-2.5-flash": 5,
                    "gemini-3-flash-preview": 0
                },
                "GEMINI_API_KEY_1": { ... }
            }
        """
        try:
            db = get_db()
            if date_str is None:
                date_str = GeminiUsage._today()

            docs = list(db[GeminiUsage.COLLECTION].find({'date': date_str}))
            usage = {}
            for doc in docs:
                key_name = doc.get('api_key_name', 'unknown')
                model_name = doc.get('model_name', 'unknown')
                count = doc.get('count', 0)
                if key_name not in usage:
                    usage[key_name] = {}
                usage[key_name][model_name] = count
            return usage
        except Exception as e:
            logging.error(f"GeminiUsage.get_all_usage error: {str(e)}")
            return {}
