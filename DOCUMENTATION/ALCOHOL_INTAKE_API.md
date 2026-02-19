# Alcohol Intake API Documentation

## Overview

The Alcohol Intake API provides comprehensive tracking and risk assessment of alcohol consumption patterns for prediabetes and type 2 diabetes risk management. This API uses epidemiology-based metrics aligned with CDC, NIAAA (National Institute on Alcohol Abuse and Alcoholism), and ADA (American Diabetes Association) guidelines.

## Table of Contents

1. [Data Model](#data-model)
2. [Risk Categories](#risk-categories)
3. [API Endpoints](#api-endpoints)
4. [Validation Rules](#validation-rules)
5. [Example Payloads](#example-payloads)
6. [Integration Guide](#integration-guide)

---

## Data Model

### AlcoholIntake Schema

```json
{
  "id": "string (ObjectId)",
  "user_id": "string",
  "average_drinks_per_day": "float (0.0-20.0)",
  "drinking_days_per_week": "integer (0-7)",
  "drinks_per_week": "float (computed)",
  "binge_frequency_per_month": "integer (0-31)",
  "alcohol_risk_category": "enum (none|light|moderate|heavy|binge)",
  "diabetes_risk_score": "integer (-5 to 20)",
  "diabetes_risk_multiplier": "float (0.95-1.55)",
  "risk_explanation": "string",
  "created_at": "ISO 8601 timestamp",
  "last_updated": "ISO 8601 timestamp",
  "history": "array of historical records"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `average_drinks_per_day` | float | No | Average number of drinks consumed on drinking days (0-20) |
| `drinking_days_per_week` | integer | No | Number of days per week alcohol is consumed (0-7) |
| `drinks_per_week` | float | Auto | Computed: `average_drinks_per_day × drinking_days_per_week` |
| `binge_frequency_per_month` | integer | No | Number of binge drinking episodes per month (0-31) |
| `alcohol_risk_category` | enum | Auto | Computed risk category based on consumption patterns |
| `diabetes_risk_score` | integer | Auto | Contribution to overall diabetes risk score |
| `diabetes_risk_multiplier` | float | Auto | Risk multiplier for diabetes prediction models |
| `risk_explanation` | string | Auto | Human-readable explanation of risk level |
| `last_updated` | timestamp | Auto | Last time data was updated |
| `history` | array | Auto | Historical records (max 12 entries) |

---

## Risk Categories

### Category Definitions

The system uses evidence-based thresholds from epidemiological research to categorize alcohol consumption risk:

#### 1. **None** (No Consumption)
- **Criteria:** 0 drinks per week
- **Diabetes Risk:** Neutral (1.0x multiplier)
- **Score:** 0
- **Recommendation:** Continue abstinence for optimal health

#### 2. **Light** (Low Risk)
- **Criteria:** ≤3 drinks per week (all genders)
- **Diabetes Risk:** Slightly protective (0.95x multiplier)
- **Score:** -5
- **Evidence:** Meta-analyses show light consumption (<3 drinks/week) associated with J-shaped protective curve against type 2 diabetes
- **Recommendation:** Maintain current intake or reduce further

#### 3. **Moderate** (Moderate Risk)
- **Criteria:**
  - Women: 4-7 drinks/week
  - Men: 4-14 drinks/week
- **Diabetes Risk:** Neutral to slightly elevated (1.0x multiplier)
- **Score:** 0
- **Evidence:** Within CDC/NIAAA moderate drinking guidelines but approaching risk thresholds
- **Recommendation:** Consider reducing intake, monitor blood glucose regularly

#### 4. **Heavy** (High Risk)
- **Criteria:**
  - Women: >7 drinks/week
  - Men: >14 drinks/week
- **Diabetes Risk:** Significantly elevated (1.43x multiplier)
- **Score:** 15
- **Evidence:** Heavy drinking increases type 2 diabetes risk by ~43% (meta-analysis data)
- **Recommendation:** Strongly reduce consumption, seek healthcare support

#### 5. **Binge** (Highest Risk)
- **Criteria:**
  - ≥1 binge episode per month
  - Binge = ≥4 drinks/occasion (women) or ≥5 drinks/occasion (men)
- **Diabetes Risk:** Highest (1.55x multiplier)
- **Score:** 20
- **Evidence:** Binge drinking causes acute blood sugar dysregulation and increases long-term diabetes risk by 40-60%
- **Recommendation:** Immediate intervention recommended, seek professional support

### Standard Drink Equivalents

One standard drink contains ~14 grams of pure alcohol:
- 12 oz beer (5% ABV)
- 5 oz wine (12% ABV)
- 1.5 oz distilled spirits (40% ABV)

---

## API Endpoints

### Base URL
```
/api/v1/alcohol-intake
```

### Authentication
All endpoints require Firebase authentication token in the Authorization header:
```
Authorization: Bearer <firebase_token>
```

---

### 1. Create or Update Alcohol Intake

**Endpoint:** `POST/PUT /api/v1/alcohol-intake/`

**Description:** Create new or update existing alcohol intake data. Automatically archives previous data to history before updating.

**Headers:**
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "average_drinks_per_day": 2.5,
  "drinking_days_per_week": 3,
  "binge_frequency_per_month": 1
}
```

**All fields are optional.** Omitted fields default to 0.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alcohol intake data saved successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "user_id": "firebase_user_123",
    "average_drinks_per_day": 2.5,
    "drinking_days_per_week": 3,
    "drinks_per_week": 7.5,
    "binge_frequency_per_month": 1,
    "alcohol_risk_category": "moderate",
    "diabetes_risk_score": 0,
    "diabetes_risk_multiplier": 1.0,
    "risk_explanation": "Moderate drinking - neutral to slightly elevated risk",
    "created_at": "2026-01-04T10:30:00.000Z",
    "last_updated": "2026-01-04T10:30:00.000Z",
    "history": []
  }
}
```

**Error Responses:**

400 Bad Request:
```json
{
  "success": false,
  "message": "average_drinks_per_day cannot be negative"
}
```

---

### 2. Get Current Alcohol Intake

**Endpoint:** `GET /api/v1/alcohol-intake/`

**Description:** Retrieve current alcohol intake data for authenticated user.

**Headers:**
```
Authorization: Bearer <firebase_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alcohol intake data retrieved successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "user_id": "firebase_user_123",
    "average_drinks_per_day": 2.5,
    "drinking_days_per_week": 3,
    "drinks_per_week": 7.5,
    "binge_frequency_per_month": 1,
    "alcohol_risk_category": "moderate",
    "diabetes_risk_score": 0,
    "diabetes_risk_multiplier": 1.0,
    "risk_explanation": "Moderate drinking - neutral to slightly elevated risk",
    "created_at": "2026-01-04T10:30:00.000Z",
    "last_updated": "2026-01-04T10:30:00.000Z",
    "history": [...]
  }
}
```

**Response (200 OK - No Data):**
```json
{
  "success": true,
  "message": "No alcohol intake data found",
  "data": null
}
```

---

### 3. Get Alcohol Intake History

**Endpoint:** `GET /api/v1/alcohol-intake/history`

**Description:** Retrieve current and historical alcohol intake data (up to 12 past records).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alcohol intake history retrieved successfully",
  "data": {
    "current": {
      "average_drinks_per_day": 2.5,
      "drinking_days_per_week": 3,
      "drinks_per_week": 7.5,
      "binge_frequency_per_month": 1,
      "alcohol_risk_category": "moderate",
      "diabetes_risk_score": 0,
      "last_updated": "2026-01-04T10:30:00.000Z"
    },
    "history": [
      {
        "average_drinks_per_day": 3.0,
        "drinking_days_per_week": 4,
        "drinks_per_week": 12.0,
        "binge_frequency_per_month": 2,
        "alcohol_risk_category": "moderate",
        "diabetes_risk_score": 0,
        "timestamp": "2025-12-04T10:30:00.000Z"
      },
      {
        "average_drinks_per_day": 4.0,
        "drinking_days_per_week": 5,
        "drinks_per_week": 20.0,
        "binge_frequency_per_month": 4,
        "alcohol_risk_category": "heavy",
        "diabetes_risk_score": 15,
        "timestamp": "2025-11-04T10:30:00.000Z"
      }
    ]
  }
}
```

---

### 4. Get Risk Assessment

**Endpoint:** `GET /api/v1/alcohol-intake/risk-assessment`

**Description:** Get comprehensive risk assessment with personalized recommendations and trend analysis.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Risk assessment generated successfully",
  "data": {
    "has_data": true,
    "current_consumption": {
      "drinks_per_week": 7.5,
      "average_drinks_per_day": 2.5,
      "drinking_days_per_week": 3,
      "binge_frequency_per_month": 1
    },
    "risk_level": "moderate",
    "diabetes_risk_score": 0,
    "diabetes_risk_multiplier": 1.0,
    "risk_explanation": "Moderate drinking - neutral to slightly elevated risk",
    "recommendations": [
      "Your alcohol intake is at moderate risk level.",
      "Consider reducing to ≤7 drinks per week to lower diabetes risk.",
      "Avoid drinking on consecutive days to give your body recovery time.",
      "Monitor your blood glucose levels regularly.",
      "Always eat food when drinking to slow alcohol absorption.",
      "Stay hydrated by drinking water between alcoholic beverages."
    ],
    "trend": {
      "status": "improving",
      "message": "Great! You've reduced intake by 4.5 drinks/week (37.5%)",
      "change_drinks_per_week": -4.5,
      "percent_change": -37.5,
      "records_analyzed": 2
    },
    "last_updated": "2026-01-04T10:30:00.000Z"
  }
}
```

**Trend Status Values:**
- `improving`: Consumption has decreased
- `stable`: Consumption unchanged (< 1 drink/week difference)
- `worsening`: Consumption has increased
- `no_history`: Insufficient historical data

---

### 5. Delete Alcohol Intake

**Endpoint:** `DELETE /api/v1/alcohol-intake/`

**Description:** Delete all alcohol intake data for authenticated user.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alcohol intake data deleted successfully"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "No alcohol intake data found to delete"
}
```

---

### 6. Get Statistics (Admin)

**Endpoint:** `GET /api/v1/alcohol-intake/statistics`

**Description:** Get aggregate statistics across all users (admin only in production).

**Query Parameters:**
- `start_date` (optional): ISO format date (YYYY-MM-DD)
- `end_date` (optional): ISO format date (YYYY-MM-DD)

**Example Request:**
```
GET /api/v1/alcohol-intake/statistics?start_date=2025-01-01&end_date=2026-01-01
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Statistics retrieved successfully",
  "data": {
    "total_users": 150,
    "by_risk_category": {
      "none": {
        "count": 45,
        "avg_drinks_per_week": 0.0,
        "avg_binge_frequency": 0.0
      },
      "light": {
        "count": 60,
        "avg_drinks_per_week": 4.2,
        "avg_binge_frequency": 0.1
      },
      "moderate": {
        "count": 30,
        "avg_drinks_per_week": 10.5,
        "avg_binge_frequency": 0.8
      },
      "heavy": {
        "count": 10,
        "avg_drinks_per_week": 18.3,
        "avg_binge_frequency": 1.2
      },
      "binge": {
        "count": 5,
        "avg_drinks_per_week": 15.0,
        "avg_binge_frequency": 4.5
      }
    },
    "overall_averages": {
      "drinks_per_week": 6.8,
      "binge_frequency": 0.6
    }
  }
}
```

---

## Validation Rules

### Input Validation

| Field | Validation Rules |
|-------|-----------------|
| `average_drinks_per_day` | • Must be numeric (int or float)<br>• Cannot be negative<br>• Maximum 20 (sanity check)<br>• Defaults to 0 if not provided |
| `drinking_days_per_week` | • Must be integer<br>• Range: 0-7<br>• Defaults to 0 if not provided |
| `binge_frequency_per_month` | • Must be integer<br>• Cannot be negative<br>• Maximum 31<br>• Defaults to 0 if not provided |
| `alcohol_risk_category` | • If provided, must be one of: none, light, moderate, heavy, binge<br>• Auto-calculated if not provided (recommended) |

### Business Rules

1. **Historical Data Preservation:**
   - Each update archives current data to history array
   - History maintains up to 12 records (FIFO)
   - Original timestamps preserved in history

2. **Risk Category Calculation:**
   - Binge drinking takes precedence (if ≥1 episode/month)
   - Gender-specific thresholds applied when user gender available
   - Falls back to general thresholds if gender unknown

3. **Derived Field Calculation:**
   - `drinks_per_week` = `average_drinks_per_day` × `drinking_days_per_week`
   - Rounded to 2 decimal places

4. **Optional Input Support:**
   - All input fields are optional
   - Missing fields treated as 0
   - Allows partial data entry (e.g., only binge frequency)

---

## Example Payloads

### Example 1: Light Drinker (Low Risk)

**Request:**
```json
{
  "average_drinks_per_day": 1.5,
  "drinking_days_per_week": 2,
  "binge_frequency_per_month": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Alcohol intake data saved successfully",
  "data": {
    "drinks_per_week": 3.0,
    "alcohol_risk_category": "light",
    "diabetes_risk_score": -5,
    "diabetes_risk_multiplier": 0.95,
    "risk_explanation": "Light drinking may have slight protective effect against diabetes"
  }
}
```

---

### Example 2: Heavy Drinker (High Risk)

**Request:**
```json
{
  "average_drinks_per_day": 4.0,
  "drinking_days_per_week": 5,
  "binge_frequency_per_month": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "drinks_per_week": 20.0,
    "alcohol_risk_category": "heavy",
    "diabetes_risk_score": 15,
    "diabetes_risk_multiplier": 1.43,
    "risk_explanation": "Heavy drinking increases diabetes risk by ~43%"
  }
}
```

---

### Example 3: Binge Drinker (Highest Risk)

**Request:**
```json
{
  "average_drinks_per_day": 2.0,
  "drinking_days_per_week": 2,
  "binge_frequency_per_month": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "drinks_per_week": 4.0,
    "alcohol_risk_category": "binge",
    "diabetes_risk_score": 20,
    "diabetes_risk_multiplier": 1.55,
    "risk_explanation": "Binge drinking pattern significantly increases diabetes risk"
  }
}
```

**Note:** Even with only 4 drinks/week, binge pattern categorizes as highest risk.

---

### Example 4: No Alcohol Consumption

**Request:**
```json
{
  "average_drinks_per_day": 0,
  "drinking_days_per_week": 0,
  "binge_frequency_per_month": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "drinks_per_week": 0.0,
    "alcohol_risk_category": "none",
    "diabetes_risk_score": 0,
    "diabetes_risk_multiplier": 1.0,
    "risk_explanation": "No alcohol consumption - neutral diabetes risk"
  }
}
```

---

### Example 5: Partial Data Entry (Binge Only)

**Request:**
```json
{
  "binge_frequency_per_month": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "average_drinks_per_day": 0.0,
    "drinking_days_per_week": 0,
    "drinks_per_week": 0.0,
    "binge_frequency_per_month": 2,
    "alcohol_risk_category": "binge",
    "diabetes_risk_score": 20,
    "diabetes_risk_multiplier": 1.55
  }
}
```

---

### Example 6: Update Existing Data (History Preservation)

**First Request:**
```json
{
  "average_drinks_per_day": 5.0,
  "drinking_days_per_week": 5,
  "binge_frequency_per_month": 2
}
```

**Second Request (1 month later):**
```json
{
  "average_drinks_per_day": 2.0,
  "drinking_days_per_week": 3,
  "binge_frequency_per_month": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "drinks_per_week": 6.0,
    "alcohol_risk_category": "light",
    "diabetes_risk_score": -5,
    "history": [
      {
        "average_drinks_per_day": 5.0,
        "drinking_days_per_week": 5,
        "drinks_per_week": 25.0,
        "binge_frequency_per_month": 2,
        "alcohol_risk_category": "binge",
        "diabetes_risk_score": 20,
        "timestamp": "2025-12-04T10:30:00.000Z"
      }
    ]
  }
}
```

---

## Integration Guide

### Frontend Integration

#### React/React Native Example

```javascript
import axios from 'axios';

const API_BASE_URL = 'https://your-api.com/api/v1';

// Save alcohol intake data
async function saveAlcoholIntake(firebaseToken, data) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/alcohol-intake/`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${firebaseToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error saving alcohol intake:', error.response?.data);
    throw error;
  }
}

// Get risk assessment
async function getRiskAssessment(firebaseToken) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/alcohol-intake/risk-assessment`,
      {
        headers: {
          'Authorization': `Bearer ${firebaseToken}`
        }
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error getting risk assessment:', error);
    throw error;
  }
}

// Example usage
const alcoholData = {
  average_drinks_per_day: 2.5,
  drinking_days_per_week: 3,
  binge_frequency_per_month: 1
};

const result = await saveAlcoholIntake(userToken, alcoholData);
console.log('Risk Category:', result.data.alcohol_risk_category);

const assessment = await getRiskAssessment(userToken);
console.log('Recommendations:', assessment.recommendations);
```

#### Mobile Form Example

```javascript
// AlcoholIntakeForm.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import Slider from '@react-native-community/slider';

export default function AlcoholIntakeForm({ onSubmit }) {
  const [avgDrinks, setAvgDrinks] = useState(0);
  const [drinkingDays, setDrinkingDays] = useState(0);
  const [bingeFrequency, setBingeFrequency] = useState(0);

  const handleSubmit = () => {
    const data = {
      average_drinks_per_day: parseFloat(avgDrinks),
      drinking_days_per_week: parseInt(drinkingDays),
      binge_frequency_per_month: parseInt(bingeFrequency)
    };
    onSubmit(data);
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Average drinks per drinking day: {avgDrinks.toFixed(1)}</Text>
      <Slider
        minimumValue={0}
        maximumValue={10}
        step={0.5}
        value={avgDrinks}
        onValueChange={setAvgDrinks}
      />

      <Text>Days per week you drink: {drinkingDays}</Text>
      <Slider
        minimumValue={0}
        maximumValue={7}
        step={1}
        value={drinkingDays}
        onValueChange={setDrinkingDays}
      />

      <Text>Binge drinking episodes per month: {bingeFrequency}</Text>
      <Slider
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={bingeFrequency}
        onValueChange={setBingeFrequency}
      />

      <Button title="Save Alcohol Intake" onPress={handleSubmit} />
    </View>
  );
}
```

### Database Initialization

```python
# Initialize indexes (run once during setup)
from models.alcohol_intake import AlcoholIntake

AlcoholIntake.ensure_indexes()
```

### Integration with Diabetes Risk Model

```python
# Example: Integrate with overall diabetes risk calculation
def calculate_overall_diabetes_risk(user_id):
    from models.alcohol_intake import AlcoholIntake
    from models.smoking_intake import SmokingIntake
    from models.diabetes_assessment import DiabetesAssessment
    
    # Get all risk factors
    alcohol_data = AlcoholIntake.get_by_user_id(user_id)
    smoking_data = SmokingIntake.get_by_user_id(user_id)
    health_data = DiabetesAssessment.get_by_user_id(user_id)
    
    # Calculate composite risk score
    total_score = 0
    multiplier = 1.0
    
    if alcohol_data:
        total_score += alcohol_data['diabetes_risk_score']
        multiplier *= alcohol_data['diabetes_risk_multiplier']
    
    if smoking_data:
        total_score += smoking_data['diabetes_risk_score']
        multiplier *= smoking_data['diabetes_risk_multiplier']
    
    # Combine with other health metrics...
    
    return {
        'risk_score': total_score,
        'risk_multiplier': multiplier,
        'risk_level': categorize_risk(total_score)
    }
```

---

## Clinical References

1. **CDC Guidelines on Moderate Drinking:**
   - Women: ≤1 drink/day
   - Men: ≤2 drinks/day

2. **NIAAA Heavy Drinking Thresholds:**
   - Women: >7 drinks/week
   - Men: >14 drinks/week

3. **Binge Drinking Definition (NIAAA):**
   - Women: ≥4 drinks within 2 hours
   - Men: ≥5 drinks within 2 hours

4. **Epidemiological Evidence:**
   - Heavy drinking increases T2D risk by 43% (meta-analysis)
   - Binge drinking associated with 40-60% increased risk
   - Light-moderate intake may have J-shaped relationship with diabetes risk

---

## Error Codes Reference

| Status Code | Error Message | Meaning |
|-------------|---------------|---------|
| 400 | "Request body is required" | Empty request body |
| 400 | "average_drinks_per_day must be a number" | Invalid data type |
| 400 | "average_drinks_per_day cannot be negative" | Negative value |
| 400 | "drinking_days_per_week must be between 0 and 7" | Out of range |
| 400 | "binge_frequency_per_month cannot exceed 31" | Out of range |
| 401 | "Unauthorized" | Missing/invalid Firebase token |
| 404 | "No alcohol intake data found to delete" | Delete on non-existent record |
| 500 | "Failed to save alcohol intake data" | Internal server error |

---

## Evidence-Based Risk Thresholds Summary

| Risk Category | Drinks/Week Threshold | Gender-Specific Criteria | Risk Multiplier | Diabetes Risk Increase |
|---------------|----------------------|--------------------------|-----------------|------------------------|
| **None** | 0 | All genders | 1.0× | Neutral (baseline) |
| **Light** | ≤3 | All genders | 0.95× | Slightly protective (-5%) |
| **Moderate** | 4-7 (W), 4-14 (M) | Women: 4-7<br>Men: 4-14 | 1.0× | Neutral |
| **Heavy** | >7 (W), >14 (M) | Women: >7<br>Men: >14 | 1.43× | +43% increased risk |
| **Binge** | Any + binge episodes | ≥1 episode/month<br>(≥4 drinks for W, ≥5 for M) | 1.55× | +55% increased risk |

**Clinical Evidence:**
- CDC/NIAAA Guidelines: Moderate drinking ≤7/week (women), ≤14/week (men)
- Meta-analyses: J-shaped curve showing light consumption protective effect
- Prospective cohort studies: Heavy drinking associated with 43% increased T2D risk
- Binge drinking: Independent risk factor with 40-60% increased T2D incidence

---

## Scientific References (APA Format)

### Primary Research on Alcohol and Type 2 Diabetes Risk

**1. Heavy Drinking and Diabetes Risk (+43% increase)**

Baliunas, D. O., Taylor, B. J., Irving, H., Roerecke, M., Patra, J., Mohapatra, S., & Rehm, J. (2009). Alcohol as a risk factor for type 2 diabetes: A systematic review and meta-analysis. *Diabetes Care, 32*(11), 2123-2132. https://doi.org/10.2337/dc09-0227  
**URL:** https://diabetesjournals.org/care/article/32/11/2123/28804/Alcohol-as-a-Risk-Factor-for-Type-2-Diabetes

*Key Finding: Heavy alcohol consumption (>48g/day or ~3.4 drinks/day) increases T2D risk by 43% (RR=1.43, 95% CI: 1.20-1.70)*

---

**2. J-Shaped Curve and Protective Effect of Light Drinking**

Knott, C., Bell, S., & Britton, A. (2015). Alcohol consumption and the risk of type 2 diabetes: A systematic review and dose-response meta-analysis of more than 1.9 million individuals from 38 observational studies. *Diabetes Care, 38*(9), 1804-1812. https://doi.org/10.2337/dc15-0710  
**URL:** https://diabetesjournals.org/care/article/38/9/1804/37714/Alcohol-Consumption-and-the-Risk-of-Type-2

*Key Finding: Moderate alcohol consumption (5-29g/day or ~0.4-2 drinks/day) associated with 18% lower T2D risk (RR=0.82), demonstrating J-shaped relationship*

---

**3. Binge Drinking and Diabetes Risk (+55% increase)**

Holst, C., Becker, U., Jørgensen, M. E., Grønbaek, M., & Tolstrup, J. S. (2017). Alcohol drinking patterns and risk of diabetes: A cohort study of 70,551 men and women from the general Danish population. *Diabetologia, 60*(10), 1941-1950. https://doi.org/10.1007/s00125-017-4359-3  
**URL:** https://link.springer.com/article/10.1007/s00125-017-4359-3

*Key Finding: Binge drinking (≥5 drinks per occasion) associated with 55% increased risk of diabetes (HR=1.55) independent of average weekly consumption*

---

**4. Gender-Specific Alcohol Thresholds**

Carlsson, S., Hammar, N., Grill, V., & Kaprio, J. (2003). Alcohol consumption and the incidence of type 2 diabetes: A 20-year follow-up of the Finnish twin cohort study. *Diabetes Care, 26*(10), 2785-2790. https://doi.org/10.2337/diacare.26.10.2785  
**URL:** https://diabetesjournals.org/care/article/26/10/2785/23916/Alcohol-Consumption-and-the-Incidence-of-Type-2

*Key Finding: Gender differences in alcohol metabolism support lower thresholds for women (>7 drinks/week) vs. men (>14 drinks/week)*

---

**5. Dose-Response Relationship Meta-Analysis**

Li, X. H., Yu, F. F., Zhou, Y. H., & He, J. (2016). Association between alcohol consumption and the risk of incident type 2 diabetes: A systematic review and dose-response meta-analysis. *The American Journal of Clinical Nutrition, 103*(3), 818-829. https://doi.org/10.3945/ajcn.115.114389  
**URL:** https://academic.oup.com/ajcn/article/103/3/818/4564609

*Key Finding: Linear increase in T2D risk above 60g/day (4.3 drinks/day), with optimal protective range at 12-24g/day (0.9-1.7 drinks/day)*

---

### Clinical Guidelines and Standards

**6. National Institute on Alcohol Abuse and Alcoholism (NIAAA)**

National Institute on Alcohol Abuse and Alcoholism. (2023). *Drinking levels defined*. U.S. Department of Health and Human Services, National Institutes of Health.  
**URL:** https://www.niaaa.nih.gov/alcohol-health/overview-alcohol-consumption/moderate-binge-drinking

*Definitions: Binge drinking = ≥4 drinks (women) or ≥5 drinks (men) within 2 hours; Heavy drinking = >7 drinks/week (women) or >14 drinks/week (men)*

---

**7. Centers for Disease Control and Prevention (CDC)**

Centers for Disease Control and Prevention. (2022). *Alcohol and public health: Frequently asked questions*. U.S. Department of Health and Human Services.  
**URL:** https://www.cdc.gov/alcohol/faqs.htm

*Moderate Drinking Guidelines: ≤1 drink/day for women, ≤2 drinks/day for men*

---

**8. American Diabetes Association (ADA)**

American Diabetes Association. (2023). Facilitating positive health behaviors and well-being to improve health outcomes: Standards of Care in Diabetes—2024. *Diabetes Care, 47*(Supplement_1), S77-S110. https://doi.org/10.2337/dc24-S006  
**URL:** https://diabetesjournals.org/care/article/47/Supplement_1/S77/153961/6-Facilitating-Positive-Health-Behaviors-and-Well

*Recommendation: Adults with diabetes who drink alcohol should do so in moderation (≤1 drink/day for women, ≤2 drinks/day for men)*

---

**9. World Health Organization (WHO)**

World Health Organization. (2018). *Global status report on alcohol and health 2018*. Geneva: World Health Organization.  
**URL:** https://www.who.int/publications/i/item/9789241565639

*Standard Drink Definition: 10 grams of pure ethanol (international standard); Note: U.S. uses 14g standard*

---

### Additional Supporting Research

**10. Acute Effects of Binge Drinking on Glucose Metabolism**

Rasineni, K., Donohue, T. M., Thomes, P. G., Yang, L., Tuma, D. J., McNiven, M. A., & Casey, C. A. (2017). Chronic alcohol exposure alters circulating insulin and ghrelin levels: Implications for prevention of hyperglycemia in alcohol abusers. *Biomolecules, 7*(3), 55. https://doi.org/10.3390/biom7030055  
**URL:** https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5618247/

*Mechanism: Binge drinking causes acute insulin resistance and impairs glucose homeostasis*

---

**11. Systematic Review - Alcohol Consumption Patterns**

Pearson, T. A. (1996). Alcohol and heart disease. *Circulation, 94*(11), 3023-3025. https://doi.org/10.1161/01.CIR.94.11.3023  
**URL:** https://www.ahajournals.org/doi/10.1161/01.CIR.94.11.3023

*Pattern Recognition: Drinking pattern (regular vs. binge) more important than total volume for cardiometabolic risk*

---

### Risk Calculation Methodology

The risk multipliers used in this API are derived from pooled relative risk (RR) estimates from the meta-analyses cited above:

- **Light (0.95×)**: Based on Knott et al. (2015) RR=0.82 for moderate consumption, conservatively adjusted
- **Moderate (1.0×)**: Baseline risk (within CDC/NIAAA guidelines)
- **Heavy (1.43×)**: Direct from Baliunas et al. (2009) RR=1.43 for heavy drinking
- **Binge (1.55×)**: Based on Holst et al. (2017) HR=1.55 for binge drinking patterns

**Risk Score Calculation:**
```
Diabetes Risk Score = Base Score × Alcohol Risk Multiplier

Where:
- Light: -5 points (protective effect)
- Moderate: 0 points (neutral)
- Heavy: +15 points (elevated risk)
- Binge: +20 points (highest risk)
```

---

## Version History

- **v1.0** (2026-01-04): Initial release with evidence-based risk thresholds, full CRUD operations, risk assessment, and historical tracking

---

## Support

For technical support or questions about the Alcohol Intake API, please contact the GlycoFit development team.
