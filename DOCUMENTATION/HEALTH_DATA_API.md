# Health Data API Documentation

This API handles synchronization of Health Connect data from mobile devices and provides statistics endpoints.

## Base URL
```
/api/v1/health-data
```

## Authentication
All endpoints require Firebase authentication. Include the Firebase ID token in the Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

---

## Endpoints

### 1. Sync Health Data
**POST** `/sync`

Sync health data from mobile device. This endpoint will automatically skip duplicate records (same timestamp).

**Request Body:**
```json
{
  "data": [
    {
      "data_type": "heart_rate",
      "value": 75,
      "unit": "bpm",
      "timestamp": "2025-11-22T10:30:00Z",
      "metadata": {
        "source": "watch"
      }
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
      "metadata": {
        "exercise_type": "running",
        "distance": 5000
      }
    }
  ]
}
```

**Valid data_types:**
- `heart_rate` - Heart rate in bpm
- `active_calories` - Active calories burned in kcal
- `exercise` - Exercise duration in minutes

**Response:**
```json
{
  "message": "Health data synced successfully",
  "total_records": 3,
  "inserted_count": 3,
  "skipped_count": 0
}
```

---

### 2. Get Latest Sync Timestamps
**GET** `/latest-sync`

Get the timestamp of the latest synced data for each data type. Use this to determine which new data needs to be synced.

**Response:**
```json
{
  "latest_syncs": {
    "heart_rate": "2025-11-22T10:30:00Z",
    "active_calories": "2025-11-22T10:30:00Z",
    "exercise": "2025-11-22T10:00:00Z"
  }
}
```

---

### 3. Get Health Data
**GET** `/`

Get health data with optional filters.

**Query Parameters:**
- `data_type` (optional) - Filter by data type (heart_rate, active_calories, exercise)
- `start_date` (optional) - Start date in ISO format
- `end_date` (optional) - End date in ISO format

**Example:**
```
GET /api/v1/health-data?data_type=heart_rate&start_date=2025-11-21T00:00:00Z&end_date=2025-11-22T23:59:59Z
```

**Response:**
```json
{
  "data": [
    {
      "user_id": "firebase-uid",
      "data_type": "heart_rate",
      "value": 75,
      "unit": "bpm",
      "timestamp": "2025-11-22T10:30:00Z",
      "metadata": {},
      "synced_at": "2025-11-22T10:35:00Z",
      "created_at": "2025-11-22T10:35:00Z"
    }
  ],
  "count": 1
}
```

---

### 4. Get Daily Statistics
**GET** `/statistics/daily`

Get statistics for a specific day.

**Query Parameters:**
- `data_type` (required) - Type of data (heart_rate, active_calories, exercise)
- `date` (optional) - Date in ISO format (defaults to today)

**Example:**
```
GET /api/v1/health-data/statistics/daily?data_type=heart_rate&date=2025-11-22
```

**Response:**
```json
{
  "date": "2025-11-22T00:00:00Z",
  "data_type": "heart_rate",
  "total": 7200,
  "average": 75.5,
  "min": 60,
  "max": 95,
  "count": 96
}
```

---

### 5. Get Weekly Statistics
**GET** `/statistics/weekly`

Get statistics for a week (7 days).

**Query Parameters:**
- `data_type` (required) - Type of data
- `start_date` (optional) - Start date of the week (defaults to start of current week/Monday)

**Example:**
```
GET /api/v1/health-data/statistics/weekly?data_type=active_calories&start_date=2025-11-18
```

**Response:**
```json
{
  "start_date": "2025-11-18T00:00:00Z",
  "end_date": "2025-11-25T00:00:00Z",
  "data_type": "active_calories",
  "total": 2500,
  "average": 357.14,
  "min": 200,
  "max": 500,
  "count": 7
}
```

---

### 6. Get Monthly Statistics
**GET** `/statistics/monthly`

Get statistics for a specific month.

**Query Parameters:**
- `data_type` (required) - Type of data
- `year` (optional) - Year (defaults to current year)
- `month` (optional) - Month 1-12 (defaults to current month)

**Example:**
```
GET /api/v1/health-data/statistics/monthly?data_type=exercise&year=2025&month=11
```

**Response:**
```json
{
  "year": 2025,
  "month": 11,
  "start_date": "2025-11-01T00:00:00Z",
  "end_date": "2025-12-01T00:00:00Z",
  "data_type": "exercise",
  "total": 900,
  "average": 30,
  "min": 15,
  "max": 60,
  "count": 30
}
```

---

### 7. Get Statistics Summary
**GET** `/statistics/summary`

Get a summary of statistics for all data types at once.

**Query Parameters:**
- `period` (optional) - Period type: 'day', 'week', or 'month' (defaults to 'day')
- `date` (optional) - Date for the period (ISO format, defaults to today)

**Example:**
```
GET /api/v1/health-data/statistics/summary?period=day&date=2025-11-22
```

**Response:**
```json
{
  "period": "day",
  "summary": {
    "heart_rate": {
      "date": "2025-11-22T00:00:00Z",
      "data_type": "heart_rate",
      "total": 7200,
      "average": 75.5,
      "min": 60,
      "max": 95,
      "count": 96
    },
    "active_calories": {
      "date": "2025-11-22T00:00:00Z",
      "data_type": "active_calories",
      "total": 450,
      "average": 450,
      "min": 450,
      "max": 450,
      "count": 1
    },
    "exercise": {
      "date": "2025-11-22T00:00:00Z",
      "data_type": "exercise",
      "total": 60,
      "average": 30,
      "min": 30,
      "max": 30,
      "count": 2
    }
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

**401 Unauthorized**
```json
{
  "error": "User not authenticated"
}
```

**400 Bad Request**
```json
{
  "error": "No data provided"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to sync health data",
  "details": "Error message details"
}
```

---

## Data Flow Example

### Initial Sync
1. Mobile app fetches Health Connect data
2. Mobile app calls `POST /sync` with all records
3. Backend saves only new records (skips duplicates based on timestamp)

### Incremental Sync
1. Mobile app calls `GET /latest-sync` to get last sync timestamps
2. Mobile app fetches only new Health Connect records after those timestamps
3. Mobile app calls `POST /sync` with only new records
4. Backend saves new records

### Getting Statistics
1. Mobile app calls `GET /statistics/summary?period=day` to show daily overview
2. Mobile app calls `GET /statistics/weekly?data_type=heart_rate` for detailed charts
3. Mobile app calls `GET /statistics/monthly?data_type=active_calories&year=2025&month=11` for monthly reports

---

## Database Schema

### Collection: `health_data`

```javascript
{
  "_id": ObjectId,
  "user_id": "firebase-uid",
  "data_type": "heart_rate|active_calories|exercise",
  "value": 75.5,
  "unit": "bpm|kcal|minutes",
  "timestamp": ISODate("2025-11-22T10:30:00Z"),
  "metadata": {
    "source": "watch",
    "exercise_type": "running",
    "distance": 5000
  },
  "synced_at": ISODate("2025-11-22T10:35:00Z"),
  "created_at": ISODate("2025-11-22T10:35:00Z")
}
```

### Indexes

For optimal performance, create these indexes:

```javascript
db.health_data.createIndex({ "user_id": 1, "data_type": 1, "timestamp": -1 })
db.health_data.createIndex({ "user_id": 1, "data_type": 1, "timestamp": 1 })
db.health_data.createIndex({ "user_id": 1, "timestamp": -1 })
```

---

## Notes

- All timestamps are stored and returned in UTC ISO format
- Duplicate detection is based on exact timestamp match per user and data_type
- Statistics calculations are done using MongoDB aggregation for efficiency
- Metadata field is flexible and can store additional information specific to each data type
