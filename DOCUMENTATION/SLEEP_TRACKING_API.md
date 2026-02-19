# Sleep Tracking API Documentation

## Overview

The Sleep Tracking API provides endpoints for managing sleep data to assess prediabetes and type 2 diabetes risk based on epidemiological research.

### Base URL
```
/api/v1/sleep-tracking
```

### Authentication
All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

---

## Data Sources

| Source | Description | Required |
|--------|-------------|----------|
| `manual_baseline` | User's usual sleep pattern (onboarding) | **Yes** |
| `manual_daily_log` | User-entered daily sleep records | Optional |
| `health_connect_daily` | Android Health Connect data | Optional |

---

## Risk Logic (Study-Based)

| Pattern | Impact | Risk Score |
|---------|--------|------------|
| Short sleep (<6h/night) | Increases insulin resistance | +25 points* |
| Very short sleep (<5h/night) | Severe insulin resistance | +40 points* |
| Long sleep (>9h/night) | Increases diabetes incidence | +20 points* |
| High sleep variability (>1.5h SD) | Increases metabolic risk | +15 points* |
| High bedtime variability (>90min SD) | Increases metabolic risk | +10 points* |
| Optimal sleep (7-8h/night) | Baseline risk | -5 points* |

**Risk penalties are scaled by data confidence level (see Confidence-Weighted Assessment below)*

### Risk Categories
- **LOW** (0-25): Minimal sleep-related diabetes risk
- **MODERATE** (26-50): Some risk factors present
- **HIGH** (51-75): Multiple risk factors, intervention recommended
- **VERY_HIGH** (76-100): Significant risk, immediate attention needed

---

## Confidence-Weighted Risk Assessment

### Overview

To prevent unstable risk scores with limited data, the system implements a **confidence-weighted model** that blends actual tracked data with baseline estimates. This approach is based on clinical research guidelines and established medical risk assessment methodologies.

### Research Basis

| Study/Guideline | Recommendation | Implementation |
|-----------------|----------------|----------------|
| American Academy of Sleep Medicine | 2-week sleep diaries for clinical assessment | Minimum 14 days for variability analysis |
| Epidemiological Sleep Studies | 7-14 day minimum for reliable averages | Progressive confidence scaling from 7 days |
| Statistical Sleep Research | Coefficient of variation stabilizes after 10-14 nights | Variability metrics only computed at 14+ days |
| Framingham Risk Score Methodology | Limited data requires conservative weighting | Baseline-weighted scoring for <7 days |

### Confidence Levels by Data Quantity

| Days Tracked | Data Weight | Baseline Weight | Confidence Level | Behavior |
|--------------|-------------|-----------------|------------------|----------|
| **<7 days** | 30% | 70% | Preliminary | Heavy baseline weighting prevents wild swings |
| **7-13 days** | 50% | 50% | Moderate | Balanced blend of actual and baseline data |
| **14-29 days** | 75% | 25% | Good | Primarily actual data, variability analysis enabled |
| **30+ days** | 90% | 10% | High | Strong confidence in actual data patterns |

### Weighted Calculation Formula

```python
# Sleep duration average
weighted_avg_sleep = (avg_sleep * data_weight) + (baseline_avg * baseline_weight)

# Risk penalty scaling
adjusted_penalty = (base_penalty * data_weight) + (baseline_penalty * baseline_weight)

# Example: Short sleep (<6h) with only 3 days of data
# Base penalty: +25 points
# Data weight: 30%, Baseline weight: 70%
# If baseline suggests adequate sleep (7.5h):
#   Actual data penalty: 25 * 0.30 = 7.5 points
#   Baseline offset: 0 * 0.70 = 0 points
#   Total: 7.5 points (instead of full 25)
```

### Variability Analysis Guard

**Sleep and bedtime variability metrics are ONLY assessed when there are 14+ days of data.**

**Rationale:**
- Statistical reliability: Standard deviation requires adequate sample size
- Clinical guidelines: Sleep diaries need 2+ weeks for pattern detection
- Mathematical stability: Coefficient of variation stabilizes after 10-14 observations

**Impact:**
- Users with <14 days of data will NOT receive variability-based risk penalties
- Prevents false positives from small sample noise
- Aligns with clinical practice standards

### User Feedback Messages

The system provides transparent feedback about data confidence:

| Days Tracked | Warning Message |
|--------------|-----------------|
| **<7 days** | ⚠️ Assessment based on only X day(s). Track for at least 7 days for reliable risk assessment. |
| **7-13 days** | ℹ️ Assessment based on X days. Track for 14+ days for more accurate variability assessment. |
| **14+ days** | ✓ Assessment based on sufficient data (X days tracked). |

### API Response Changes

The risk assessment endpoint now includes additional fields:

```json
{
  "risk_score": 7.5,
  "risk_category": "low",
  "confidence_level": "preliminary",
  "days_tracked": 3,
  "risk_factors": [],
  "recommendations": [
    "⚠️ Assessment based on only 3 day(s). Track for at least 7 days for reliable risk assessment.",
    "Great! Your sleep duration is in the optimal range of 7-8 hours."
  ],
  
  // NEW: Actual risk based on tracked data only (no baseline weighting)
  "actual_risk_score": 40.0,
  "actual_risk_category": "moderate",
  "actual_risk_factors": ["very_short_sleep"],
  "early_warning": "⚠️ Early Warning: Your recent sleep data shows higher risk patterns (actual risk: 40). Continue tracking to confirm trends."
}
```

**Field Descriptions:**
- `risk_score` / `risk_category`: Confidence-weighted assessment (blends actual data + baseline)
- `actual_risk_score` / `actual_risk_category`: **NEW** - Unweighted assessment based purely on tracked data
- `actual_risk_factors`: **NEW** - Risk factors detected in your actual sleep data
- `early_warning`: **NEW** - Alert shown when actual risk significantly differs from weighted risk
- `confidence_level`: Data quality indicator ("preliminary", "moderate", "good", "high")
- `days_tracked`: Number of days with sleep data

**Why Two Scores?**

1. **Weighted Score** (primary): Prevents score volatility with limited data by blending your baseline responses with actual tracked sleep. This is your stable, conservative assessment.

2. **Actual Risk Score** (early warning): Shows risk based purely on your tracked sleep patterns, ignoring baseline. This provides early warning even when you have good baseline but poor recent sleep.

### Benefits

1. **Stability**: Prevents score volatility with limited data (weighted score blends baseline + actual data)
2. **Early Warning**: Actual risk score alerts users to concerning patterns even with <14 days of data
3. **Clinical Validity**: Aligns with medical research best practices
4. **User Trust**: Transparent dual scoring builds trust - stable primary score + early warning
5. **Progressive Accuracy**: Both scores become more precise as user tracks more data
6. **Conservative Approach**: Weighted score errs on the side of caution with insufficient data

**Example Scenario:**
- **Day 3**: Good baseline (7.5h), poor tracked sleep (4h)
  - Weighted score: **8 points** (LOW) - conservative, prevents panic
  - Actual risk: **40 points** (MODERATE) - early warning of poor sleep pattern
  - Early warning message shown: "Your recent sleep data shows higher risk patterns"
  
- **Day 14**: Same poor sleep continues
  - Weighted score: **38 points** (MODERATE) - now reflects sustained poor sleep
  - Actual risk: **40 points** (MODERATE) - confirms the pattern
  - Variability penalties now included

---

## Source Weighting Logic

1. **No daily records** → Use baseline only
2. **Daily records exist** → Use rolling averages
3. **Health Connect exists** → Prioritize Health Connect after 30 days of data

---

## Endpoints

### Baseline Endpoints

#### Create Baseline (Required at Onboarding)
```http
POST /baseline
```

**Request Body:**
```json
{
    "baseline_avg_sleep_hours": 7.5,
    "baseline_nights_6h_plus_per_week": 5,
    "baseline_bedtime_consistency": 4,
    "usual_bedtime": "22:30",
    "usual_wake_time": "06:30"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseline_avg_sleep_hours` | float | Yes | Average hours of sleep (0-24) |
| `baseline_nights_6h_plus_per_week` | int | Yes | Nights with 6+ hours (0-7) |
| `baseline_bedtime_consistency` | int | Yes | Self-reported consistency (1-5) |
| `usual_bedtime` | string | No | Typical bedtime (HH:MM, 24-hour) |
| `usual_wake_time` | string | No | Typical wake time (HH:MM, 24-hour) |

**Response (201 Created):**
```json
{
    "success": true,
    "message": "Sleep baseline created successfully",
    "data": {
        "user_id": "user_123",
        "baseline_avg_sleep_hours": 7.5,
        "baseline_nights_6h_plus_per_week": 5,
        "baseline_bedtime_consistency": 4,
        "usual_bedtime": "22:30",
        "usual_wake_time": "06:30",
        "created_at": "2024-01-15T10:30:00Z",
        "is_locked": true
    }
}
```

**Error (400 Bad Request):**
```json
{
    "success": false,
    "error": "Sleep baseline already exists and cannot be modified"
}
```

---

#### Get Baseline
```http
GET /baseline
```

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "user_id": "user_123",
        "baseline_avg_sleep_hours": 7.5,
        "baseline_nights_6h_plus_per_week": 5,
        "baseline_bedtime_consistency": 4,
        "usual_bedtime": "22:30",
        "usual_wake_time": "06:30",
        "created_at": "2024-01-15T10:30:00Z",
        "is_locked": true
    },
    "has_baseline": true
}
```

---

#### Check Baseline Status
```http
GET /baseline/check
```

**Response (200 OK):**
```json
{
    "success": true,
    "has_baseline": true
}
```

---

### Daily Record Endpoints

#### Log Manual Daily Sleep
```http
POST /daily
```

**Request Body:**
```json
{
    "date": "2024-01-15",
    "bedtime": "22:30",
    "sleep_duration_hours": 7.5,
    "wake_time": "06:00",
    "sleep_quality": 4,
    "notes": "Felt well rested"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | Yes | Date (YYYY-MM-DD) |
| `bedtime` | string | Yes | Bedtime (HH:MM, 24-hour) |
| `sleep_duration_hours` | float | Yes | Sleep duration (0-24) |
| `wake_time` | string | No | Wake time (derived if not provided) |
| `sleep_quality` | int | No | Quality rating (1-5) |
| `notes` | string | No | Optional notes |

**Response (201 Created):**
```json
{
    "success": true,
    "message": "Sleep record logged successfully",
    "data": {
        "user_id": "user_123",
        "date": "2024-01-15",
        "bedtime": "22:30",
        "wake_time": "06:00",
        "sleep_duration_hours": 7.5,
        "source": "manual",
        "sleep_quality": 4,
        "notes": "Felt well rested",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
    }
}
```

---

#### Get Daily Records
```http
GET /daily
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start_date` | string | - | Start date (YYYY-MM-DD) |
| `end_date` | string | - | End date (YYYY-MM-DD) |
| `days` | int | 30 | Days to fetch (if no date range) |
| `source` | string | - | Filter: `manual` or `health_connect` |

**Response (200 OK):**
```json
{
    "success": true,
    "data": [
        {
            "user_id": "user_123",
            "date": "2024-01-15",
            "bedtime": "22:30",
            "wake_time": "06:00",
            "sleep_duration_hours": 7.5,
            "source": "manual",
            "sleep_quality": 4,
            "notes": "Felt well rested"
        }
    ],
    "count": 1
}
```

---

#### Delete Daily Record
```http
DELETE /daily/:date
```

**Path Parameters:**
- `date`: Date to delete (YYYY-MM-DD)

**Query Parameters:**
- `source`: Optional filter (`manual` or `health_connect`)

**Response (200 OK):**
```json
{
    "success": true,
    "message": "Deleted 1 record(s)",
    "deleted": 1
}
```

---

### Health Connect Endpoints

#### Sync Health Connect Data
```http
POST /health-connect/sync
```

**Request Body:**
```json
{
    "records": [
        {
            "date": "2024-01-15",
            "bedtime": "22:30",
            "wake_time": "06:00",
            "sleep_duration_hours": 7.5
        },
        {
            "date": "2024-01-14",
            "bedtime": "23:00",
            "wake_time": "06:30",
            "sleep_duration_hours": 7.0
        }
    ]
}
```

**Response (200 OK):**
```json
{
    "success": true,
    "message": "Successfully synced 2 sleep records",
    "synced": 2,
    "skipped": 0,
    "errors": null
}
```

---

### Metrics Endpoints

#### Get Computed Metrics
```http
GET /metrics
```

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "user_id": "user_123",
        "avg_sleep_7d": 7.2,
        "avg_sleep_30d": 7.0,
        "bedtime_mean_30d": "22:45",
        "bedtime_variability_30d": 35.5,
        "sleep_variability_30d": 0.8,
        "dominant_sleep_source": "mixed",
        "days_with_data_7d": 5,
        "days_with_data_30d": 18,
        "risk_category": "low",
        "risk_factors": [],
        "risk_score": 15.0,
        "computed_at": "2024-01-15T10:30:00Z"
    }
}
```

---

#### Force Refresh Metrics
```http
POST /metrics/refresh
```

**Response (200 OK):**
```json
{
    "success": true,
    "message": "Metrics refreshed successfully",
    "data": { ... }
}
```

---

### Risk Assessment Endpoints

#### Get Latest Risk Assessment
```http
GET /risk
```

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "user_id": "user_123",
        "assessment_date": "2024-01-15",
        "risk_category": "moderate",
        "risk_score": 35.0,
        "risk_factors": [
            "short_sleep",
            "moderate_bedtime_variability"
        ],
        "recommendations": [
            "Getting less than 6 hours of sleep increases insulin resistance. Try to gradually increase your sleep duration.",
            "Your bedtime varies moderately. Try to maintain a more consistent sleep schedule."
        ],
        "data_quality": "good",
        "metrics_snapshot": { ... },
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

---

#### Get Risk History
```http
GET /risk/history
```

**Query Parameters:**
- `limit`: Maximum assessments to return (default: 30)

**Response (200 OK):**
```json
{
    "success": true,
    "data": [
        {
            "assessment_date": "2024-01-15",
            "risk_category": "moderate",
            "risk_score": 35.0,
            "risk_factors": ["short_sleep"]
        },
        {
            "assessment_date": "2024-01-14",
            "risk_category": "moderate",
            "risk_score": 38.0,
            "risk_factors": ["short_sleep", "high_bedtime_variability"]
        }
    ],
    "count": 2
}
```

---

### Summary Endpoint

#### Get Comprehensive Dashboard Summary
```http
GET /summary
```

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "status": {
            "has_baseline": true,
            "has_daily_data": true,
            "days_tracked_last_week": 5,
            "onboarding_complete": true
        },
        "baseline": {
            "baseline_avg_sleep_hours": 7.5,
            "baseline_nights_6h_plus_per_week": 5,
            "baseline_bedtime_consistency": 4,
            "usual_bedtime": "22:30",
            "usual_wake_time": "06:30"
        },
        "metrics": {
            "avg_sleep_7d": 7.2,
            "avg_sleep_30d": 7.0,
            "bedtime_mean_30d": "22:45",
            "bedtime_variability_30d": 35.5,
            "sleep_variability_30d": 0.8,
            "dominant_sleep_source": "mixed",
            "risk_category": "low",
            "risk_score": 15.0
        },
        "risk_assessment": {
            "risk_category": "low",
            "risk_score": 15.0,
            "risk_factors": [],
            "recommendations": [
                "Great! Your sleep duration is in the optimal range of 7-8 hours."
            ],
            "data_quality": "good"
        },
        "recent_records": [
            {
                "date": "2024-01-15",
                "bedtime": "22:30",
                "sleep_duration_hours": 7.5,
                "source": "manual"
            }
        ],
        "recommendations": [
            "Great! Your sleep duration is in the optimal range of 7-8 hours."
        ]
    }
}
```

---

## Database Schema

### Collections

#### sleep_baselines
```javascript
{
    "_id": ObjectId,
    "user_id": String (unique, indexed),
    "baseline_avg_sleep_hours": Number,
    "baseline_nights_6h_plus_per_week": Number (0-7),
    "baseline_bedtime_consistency": Number (1-5),
    "usual_bedtime": String (HH:MM),
    "usual_wake_time": String (HH:MM),
    "created_at": DateTime,
    "is_locked": Boolean (always true)
}
```

#### sleep_daily_records
```javascript
{
    "_id": ObjectId,
    "user_id": String (indexed),
    "date": String (YYYY-MM-DD, indexed),
    "bedtime": String (HH:MM),
    "wake_time": String (HH:MM),
    "sleep_duration_hours": Number,
    "source": String ("manual" | "health_connect"),
    "sleep_quality": Number (1-5, optional),
    "notes": String (optional),
    "created_at": DateTime,
    "updated_at": DateTime
}
// Compound unique index: (user_id, date, source)
```

#### sleep_metrics
```javascript
{
    "_id": ObjectId,
    "user_id": String (unique, indexed),
    "avg_sleep_7d": Number,
    "avg_sleep_30d": Number,
    "bedtime_mean_30d": String (HH:MM),
    "bedtime_variability_30d": Number (minutes),
    "sleep_variability_30d": Number (hours),
    "dominant_sleep_source": String,
    "days_with_data_7d": Number,
    "days_with_data_30d": Number,
    "risk_category": String,
    "risk_factors": Array[String],
    "risk_score": Number (0-100),
    "computed_at": DateTime
}
```

#### sleep_risk_assessments
```javascript
{
    "_id": ObjectId,
    "user_id": String (indexed),
    "assessment_date": String (YYYY-MM-DD),
    "risk_category": String,
    "risk_score": Number (0-100),
    "risk_factors": Array[String],
    "recommendations": Array[String],
    "data_quality": String,
    "metrics_snapshot": Object,
    "created_at": DateTime
}
// Compound unique index: (user_id, assessment_date)
```

---

## Derived Metrics Computation

### Rolling Averages

```python
# Pseudocode for computing rolling averages

def compute_rolling_average(records, days):
    """
    Compute rolling average sleep duration.
    Missing days do NOT penalize the user.
    """
    # Filter records within date range
    cutoff = today - timedelta(days=days)
    filtered = [r for r in records if r.date >= cutoff]
    
    # Minimum 3 days required for meaningful average
    if len(filtered) < 3:
        return None  # Fall back to baseline
    
    # Simple mean of available data
    return mean([r.sleep_duration_hours for r in filtered])
```

### Bedtime Variability

```python
def compute_bedtime_variability(records):
    """
    Compute standard deviation of bedtime in minutes.
    Handles midnight crossover (late night bedtimes).
    """
    bedtime_minutes = []
    for r in records:
        minutes = time_to_minutes(r.bedtime)
        # Adjust for late night (00:00-06:00 = next day)
        if minutes < 360:  # Before 6 AM
            minutes += 1440  # Add 24 hours
        bedtime_minutes.append(minutes)
    
    return stdev(bedtime_minutes) if len(bedtime_minutes) >= 2 else None
```

### Source Weighting

```python
def apply_source_weighting(records, health_connect_count):
    """
    Prioritize Health Connect data when sufficient history exists.
    """
    # Group records by date
    by_date = group_by(records, key=lambda r: r.date)
    
    weighted = []
    for date, date_records in by_date.items():
        if len(date_records) == 1:
            weighted.append(date_records[0])
        else:
            # Prefer Health Connect if available
            hc_record = find(date_records, source="health_connect")
            weighted.append(hc_record or date_records[0])
    
    return weighted
```

---

## Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input or baseline already exists |
| 401 | Unauthorized - Missing or invalid JWT token |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error |

---

## Notes

1. **Baseline is immutable**: Once created, the baseline cannot be modified. This ensures the original sleep pattern is preserved.

2. **Missing days don't penalize users**: The system uses available data for averages rather than assuming zero sleep for missing days.

3. **Self-correcting risk assessment**: As more data accumulates, the risk assessment becomes more accurate and less dependent on the initial baseline.

4. **Health Connect priority**: After 30 days of Health Connect data, it takes priority over manual logs for the same dates (assumed to be more accurate).
