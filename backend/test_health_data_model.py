"""Test script to verify HealthData model works correctly"""
from models.health_data import HealthData
from datetime import datetime

# Test data similar to what's being sent from frontend
test_record = {
    "user_id": "test_user_123",
    "data_type": "active_calories",
    "value": 16,  # Integer value
    "unit": "kcal",
    "timestamp": "2025-11-19T00:00:00Z",
    "metadata": {
        "source": "health_connect",
        "end_time": "2025-11-19T00:29:59Z"
    }
}

print("Testing HealthData model...")
print(f"Input: {test_record}")

try:
    # Create HealthData object
    health_data = HealthData(
        user_id=test_record['user_id'],
        data_type=test_record['data_type'],
        value=test_record['value'],
        unit=test_record['unit'],
        timestamp=test_record['timestamp'],
        metadata=test_record['metadata']
    )
    
    print("\n✓ HealthData object created successfully")
    print(f"  - Value type: {type(health_data.value)}")
    print(f"  - Value: {health_data.value}")
    print(f"  - Timestamp type: {type(health_data.timestamp)}")
    print(f"  - Timestamp: {health_data.timestamp}")
    
    # Test to_dict conversion
    dict_data = health_data.to_dict()
    print("\n✓ to_dict() conversion successful")
    print(f"  - Dict value type: {type(dict_data['value'])}")
    print(f"  - Dict value: {dict_data['value']}")
    print(f"\nFull dict: {dict_data}")
    
    print("\n✅ All tests passed!")
    
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
