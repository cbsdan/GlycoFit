from flask import request, jsonify, g
from models.physician import Physician
from models.physician_availability import PhysicianAvailability
from models.appointment import Appointment
from datetime import datetime, time, timedelta
from bson import ObjectId
import logging

def create_availability():
    """Create a new availability schedule"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        # Validate required fields
        required_fields = ['day_of_week', 'start_time', 'end_time']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Parse times
        start_time = datetime.fromisoformat(data['start_time']).time()
        end_time = datetime.fromisoformat(data['end_time']).time()
        
        # Validate times
        if start_time >= end_time:
            return jsonify({
                'success': False,
                'message': 'Start time must be before end time'
            }), 400
        
        availability = PhysicianAvailability(
            physician_id=physician._id,
            day_of_week=int(data['day_of_week']),
            start_time=start_time,
            end_time=end_time,
            slot_duration_minutes=data.get('slot_duration_minutes', 30)
        )
        
        availability.save()
        
        return jsonify({
            'success': True,
            'message': 'Availability created successfully',
            'data': availability.to_safe_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Error creating availability: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create availability'
        }), 500

def get_availability():
    """Get availability schedules for physician"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        day_of_week = request.args.get('day_of_week', type=int)
        
        # Handle is_active parameter properly
        is_active_param = request.args.get('is_active')
        if is_active_param is None:
            is_active = None  # Don't filter by is_active if not provided
        else:
            is_active = is_active_param.lower() in ('true', '1', 'yes')
        
        availabilities = PhysicianAvailability.get_physician_availability(
            physician._id,
            day_of_week=day_of_week,
            is_active=is_active
        )
        
        result = [availability.to_safe_dict() for availability in availabilities]
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting availability: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get availability'
        }), 500

def update_availability(availability_id):
    """Update an availability schedule"""
    try:
        current_user = g.current_user
        data = request.get_json()
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        availability = PhysicianAvailability.find_by_id(availability_id)
        
        if not availability:
            return jsonify({
                'success': False,
                'message': 'Availability not found'
            }), 404
        
        # Verify physician owns this availability
        if str(availability.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        # Update fields
        if 'start_time' in data:
            availability.start_time = datetime.fromisoformat(data['start_time']).time()
        
        if 'end_time' in data:
            availability.end_time = datetime.fromisoformat(data['end_time']).time()
        
        if 'slot_duration_minutes' in data:
            availability.slot_duration_minutes = int(data['slot_duration_minutes'])
        
        if 'is_active' in data:
            # Handle both boolean and string values
            if isinstance(data['is_active'], bool):
                availability.is_active = data['is_active']
            elif isinstance(data['is_active'], str):
                availability.is_active = data['is_active'].lower() in ('true', '1', 'yes')
            else:
                availability.is_active = bool(data['is_active'])
        
        # Validate times
        if availability.start_time >= availability.end_time:
            return jsonify({
                'success': False,
                'message': 'Start time must be before end time'
            }), 400
        
        availability.updated_at = datetime.utcnow()
        availability.save()
        
        return jsonify({
            'success': True,
            'message': 'Availability updated successfully',
            'data': availability.to_safe_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Error updating availability: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to update availability'
        }), 500

def delete_availability(availability_id):
    """Delete an availability schedule"""
    try:
        current_user = g.current_user
        
        physician = Physician.find_by_user_id(current_user._id)
        if not physician:
            return jsonify({
                'success': False,
                'message': 'Physician profile not found'
            }), 404
        
        availability = PhysicianAvailability.find_by_id(availability_id)
        
        if not availability:
            return jsonify({
                'success': False,
                'message': 'Availability not found'
            }), 404
        
        # Verify physician owns this availability
        if str(availability.physician_id) != str(physician._id):
            return jsonify({
                'success': False,
                'message': 'Unauthorized'
            }), 403
        
        PhysicianAvailability.delete_by_id(availability_id)
        
        return jsonify({
            'success': True,
            'message': 'Availability deleted successfully'
        }), 200
        
    except Exception as e:
        logging.error(f"Error deleting availability: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to delete availability'
        }), 500

def get_physician_available_slots(physician_id):
    """Get available appointment slots for a physician (for patients)"""
    try:
        # Get date range from query params
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str:
            start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
        
        if not end_date_str:
            end_date = start_date + timedelta(days=30)  # Default 30 days ahead
        else:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        
        if isinstance(physician_id, str):
            physician_id = ObjectId(physician_id)
        
        # Get physician's availability schedules
        availabilities = PhysicianAvailability.get_physician_availability(physician_id, is_active=True)
        
        if not availabilities:
            return jsonify({
                'success': True,
                'data': [],
                'message': 'No availability schedules found for this physician'
            }), 200
        
        # Get existing appointments
        existing_appointments = Appointment.get_physician_appointments(
            physician_id,
            start_date=start_date,
            end_date=end_date,
            status=None
        )
        
        # Create a dict of occupied slots
        occupied_slots = {}
        for apt in existing_appointments:
            if apt.status not in ['cancelled']:
                date_key = apt.appointment_date.date()
                time_key = apt.appointment_date.time().replace(second=0, microsecond=0)
                if date_key not in occupied_slots:
                    occupied_slots[date_key] = set()
                occupied_slots[date_key].add(time_key)
        
        # Generate available slots
        available_slots = []
        current_date = start_date
        
        while current_date <= end_date:
            day_of_week = current_date.weekday()  # 0=Monday, 6=Sunday
            
            # Find availability for this day
            day_availabilities = [av for av in availabilities if av.day_of_week == day_of_week]
            
            for availability in day_availabilities:
                # Generate time slots
                slot_start = datetime.combine(current_date.date(), availability.start_time)
                slot_end = datetime.combine(current_date.date(), availability.end_time)
                slot_duration = timedelta(minutes=availability.slot_duration_minutes)
                
                current_slot = slot_start
                while current_slot + slot_duration <= slot_end:
                    # Check if slot is not occupied and is in the future
                    slot_time = current_slot.time().replace(second=0, microsecond=0)
                    date_key = current_slot.date()
                    
                    is_available = (
                        current_slot > datetime.utcnow() and
                        (date_key not in occupied_slots or slot_time not in occupied_slots[date_key])
                    )
                    
                    if is_available:
                        available_slots.append({
                            'datetime': current_slot.isoformat(),
                            'date': current_slot.date().isoformat(),
                            'time': slot_time.isoformat(),
                            'duration_minutes': availability.slot_duration_minutes
                        })
                    
                    current_slot += slot_duration
            
            current_date += timedelta(days=1)
        
        return jsonify({
            'success': True,
            'data': available_slots,
            'count': len(available_slots)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting available slots: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to get available slots'
        }), 500
