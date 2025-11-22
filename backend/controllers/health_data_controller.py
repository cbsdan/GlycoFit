from flask import request, jsonify, g
from models.health_data import HealthData
from datetime import datetime, timedelta
import logging

class HealthDataController:
    """Controller for handling Health Connect data synchronization"""

    @staticmethod
    def sync_health_data():
        """
        Sync health data from mobile device
        
        Expected request body:
        {
            "data": [
                {
                    "data_type": "heart_rate",
                    "value": 75,
                    "unit": "bpm",
                    "timestamp": "2025-11-22T10:30:00Z",
                    "metadata": {"source": "watch"}
                },
                {
                    "data_type": "active_calories",
                    "value": 250,
                    "unit": "kcal",
                    "timestamp": "2025-11-22T10:30:00Z"
                },
                {
                    "data_type": "exercise",
                    "value": 30,
                    "unit": "minutes",
                    "timestamp": "2025-11-22T10:00:00Z",
                    "metadata": {"exercise_type": "running", "distance": 5000}
                }
            ]
        }
        """
        try:
            current_user = g.current_user
            if not current_user:
                return jsonify({'error': 'User not authenticated'}), 401

            data = request.get_json()
            if not data or 'data' not in data:
                return jsonify({'error': 'No data provided'}), 400

            health_records = data['data']
            if not isinstance(health_records, list):
                return jsonify({'error': 'Data must be an array'}), 400

            # Validate data types
            valid_data_types = ['heart_rate', 'exercise', 'active_calories']
            
            health_data_objects = []
            for idx, record in enumerate(health_records):
                try:
                    # Validate required fields
                    if not all(k in record for k in ['data_type', 'value', 'unit', 'timestamp']):
                        logging.warning(f"Record {idx} missing required fields: {record}")
                        continue
                    
                    # Validate data type
                    if record['data_type'] not in valid_data_types:
                        logging.warning(f"Record {idx} has invalid data_type: {record['data_type']}")
                        continue
                    
                    # Validate value is numeric
                    try:
                        value = float(record['value'])
                    except (ValueError, TypeError) as e:
                        logging.warning(f"Record {idx} has invalid value: {record['value']}")
                        continue
                    
                    # Create HealthData object
                    health_data = HealthData(
                        user_id=current_user.uid,
                        data_type=record['data_type'],
                        value=value,
                        unit=record['unit'],
                        timestamp=record['timestamp'],
                        metadata=record.get('metadata', {})
                    )
                    health_data_objects.append(health_data)
                except Exception as e:
                    logging.error(f"Error processing record {idx}: {str(e)}")
                    logging.error(f"Problematic record: {record}")
                    continue

            # Bulk insert (will skip duplicates)
            if not health_data_objects:
                return jsonify({
                    'message': 'No valid health data to sync',
                    'total_records': len(health_records),
                    'inserted_count': 0,
                    'skipped_count': len(health_records)
                }), 200
            
            inserted_count = HealthData.bulk_insert(health_data_objects)

            return jsonify({
                'success': True,
                'message': 'Health data synced successfully',
                'total_records': len(health_records),
                'inserted_count': inserted_count,
                'skipped_count': len(health_records) - inserted_count
            }), 200

        except Exception as e:
            logging.error(f"Error syncing health data: {str(e)}")
            import traceback
            logging.error(traceback.format_exc())
            return jsonify({'success': False, 'error': 'Failed to sync health data', 'details': str(e)}), 500

    @staticmethod
    def get_health_data():
        """
        Get health data with optional filters and pagination
        
        Query parameters:
        - data_type: Type of data (heart_rate, exercise, active_calories)
        - start_date: Start date (ISO format)
        - end_date: End date (ISO format)
        - limit: Maximum records to return (default: 20, max: 100)
        - skip: Records to skip for pagination (default: 0)
        """
        try:
            current_user = g.current_user
            if not current_user:
                return jsonify({'error': 'User not authenticated'}), 401

            # Get query parameters
            data_type = request.args.get('data_type')
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            limit = min(int(request.args.get('limit', 20)), 100)  # Max 100 records
            skip = int(request.args.get('skip', 0))

            # Get health data
            health_data = HealthData.get_user_data(
                user_id=current_user.uid,
                data_type=data_type,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                skip=skip
            )

            # Convert to dictionaries - only essential fields
            data_list = []
            for data in health_data:
                data_dict = {
                    '_id': str(data._id) if hasattr(data, '_id') else None,
                    'data_type': data.data_type,
                    'value': data.value,
                    'unit': data.unit,
                    'timestamp': data.timestamp.isoformat(),
                    'metadata': data.metadata
                }
                data_list.append(data_dict)

            return jsonify({
                'data': data_list,
                'count': len(data_list),
                'limit': limit,
                'skip': skip
            }), 200

        except Exception as e:
            logging.error(f"Error getting health data: {str(e)}")
            return jsonify({'error': 'Failed to get health data', 'details': str(e)}), 500

    @staticmethod
    def get_daily_statistics():
        """
        Get daily statistics for a specific date
        
        Query parameters:
        - date: Date in ISO format (defaults to today)
        - data_type: Type of data (required)
        """
        try:
            current_user = g.current_user
            if not current_user:
                return jsonify({'error': 'User not authenticated'}), 401

            # Get query parameters
            date_str = request.args.get('date')
            data_type = request.args.get('data_type')

            if not data_type:
                return jsonify({'error': 'data_type is required'}), 400

            # Parse date or use today
            if date_str:
                date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                date = datetime.utcnow()

            # Get statistics
            stats = HealthData.get_daily_statistics(
                user_id=current_user.uid,
                date=date,
                data_type=data_type
            )

            return jsonify(stats), 200

        except Exception as e:
            logging.error(f"Error getting daily statistics: {str(e)}")
            return jsonify({'error': 'Failed to get daily statistics', 'details': str(e)}), 500

    @staticmethod
    def get_weekly_statistics():
        """
        Get weekly statistics starting from a specific date
        
        Query parameters:
        - start_date: Start date of the week (ISO format, defaults to start of current week)
        - data_type: Type of data (required)
        """
        try:
            current_user = g.current_user
            if not current_user:
                return jsonify({'error': 'User not authenticated'}), 401

            # Get query parameters
            start_date_str = request.args.get('start_date')
            data_type = request.args.get('data_type')

            if not data_type:
                return jsonify({'error': 'data_type is required'}), 400

            # Parse date or use start of current week
            if start_date_str:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            else:
                # Get start of current week (Monday)
                today = datetime.utcnow()
                start_date = today - timedelta(days=today.weekday())
                start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

            # Get statistics
            stats = HealthData.get_weekly_statistics(
                user_id=current_user.uid,
                start_date=start_date,
                data_type=data_type
            )

            return jsonify(stats), 200

        except Exception as e:
            logging.error(f"Error getting weekly statistics: {str(e)}")
            return jsonify({'error': 'Failed to get weekly statistics', 'details': str(e)}), 500

    @staticmethod
    def get_monthly_statistics():
        """
        Get monthly statistics for a specific month
        
        Query parameters:
        - year: Year (defaults to current year)
        - month: Month 1-12 (defaults to current month)
        - data_type: Type of data (required)
        """
        try:
            current_user = g.current_user
            if not current_user:
                return jsonify({'error': 'User not authenticated'}), 401

            # Get query parameters
            year = request.args.get('year', type=int)
            month = request.args.get('month', type=int)
            data_type = request.args.get('data_type')

            if not data_type:
                return jsonify({'error': 'data_type is required'}), 400

            # Use current year/month if not provided
            now = datetime.utcnow()
            if not year:
                year = now.year
            if not month:
                month = now.month

            # Validate month
            if month < 1 or month > 12:
                return jsonify({'error': 'Month must be between 1 and 12'}), 400

            # Get statistics
            stats = HealthData.get_monthly_statistics(
                user_id=current_user.uid,
                year=year,
                month=month,
                data_type=data_type
            )

            return jsonify(stats), 200

        except Exception as e:
            logging.error(f"Error getting monthly statistics: {str(e)}")
            return jsonify({'error': 'Failed to get monthly statistics', 'details': str(e)}), 500

    @staticmethod
    def get_latest_sync():
        """
        Get the timestamp of the latest synced data for each data type
        
        Returns the latest sync timestamp for heart_rate, exercise, and active_calories
        """
        try:
            current_user = g.current_user
            if not current_user:
                return jsonify({'error': 'User not authenticated'}), 401

            data_types = ['heart_rate', 'exercise', 'active_calories']
            latest_syncs = {}

            for data_type in data_types:
                timestamp = HealthData.get_latest_sync_timestamp(
                    user_id=current_user.uid,
                    data_type=data_type
                )
                latest_syncs[data_type] = timestamp.isoformat() if timestamp else None

            return jsonify({
                'latest_syncs': latest_syncs
            }), 200

        except Exception as e:
            logging.error(f"Error getting latest sync: {str(e)}")
            return jsonify({'error': 'Failed to get latest sync', 'details': str(e)}), 500

    @staticmethod
    def get_statistics_summary():
        """
        Get a summary of statistics for all data types
        
        Query parameters:
        - period: 'day', 'week', or 'month' (defaults to 'day')
        - date: Date for the period (ISO format, defaults to today)
        """
        try:
            current_user = g.current_user
            if not current_user:
                return jsonify({'error': 'User not authenticated'}), 401

            period = request.args.get('period', 'day')
            date_str = request.args.get('date')

            if date_str:
                date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                date = datetime.utcnow()

            data_types = ['heart_rate', 'exercise', 'active_calories']
            summary = {}

            for data_type in data_types:
                if period == 'day':
                    stats = HealthData.get_daily_statistics(
                        user_id=current_user.uid,
                        date=date,
                        data_type=data_type
                    )
                elif period == 'week':
                    # Get start of week
                    start_of_week = date - timedelta(days=date.weekday())
                    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
                    stats = HealthData.get_weekly_statistics(
                        user_id=current_user.uid,
                        start_date=start_of_week,
                        data_type=data_type
                    )
                elif period == 'month':
                    stats = HealthData.get_monthly_statistics(
                        user_id=current_user.uid,
                        year=date.year,
                        month=date.month,
                        data_type=data_type
                    )
                else:
                    return jsonify({'error': 'Invalid period. Must be day, week, or month'}), 400

                summary[data_type] = stats

            return jsonify({
                'period': period,
                'summary': summary
            }), 200

        except Exception as e:
            logging.error(f"Error getting statistics summary: {str(e)}")
            return jsonify({'error': 'Failed to get statistics summary', 'details': str(e)}), 500
