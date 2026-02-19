# Diabetes Risk Assessment - Setup Guide

## 📦 Model Files Setup

Place your trained model files in the following location:

```
C:\GlycoFit\backend\models\
```

**Required files:**
- `diabetes_model.pkl` - Your Gradient Boosting classifier
- `diabetes_preprocessor.pkl` - Your preprocessing pipeline

## 📊 Risk Thresholds (Configured)

The system uses your calibrated model thresholds:
- **Low Risk**: 1.17% - 33.79%
- **Moderate Risk**: 33.79% - 70.17%
- **High Risk**: 70.17% - 94.22%

## 🚀 Backend Endpoints

### Submit/Update Assessment
```
POST /api/v1/diabetes-assessment/submit
Authorization: Bearer <firebase_token>

Body:
{
  "answers": {
    "HighBP": 0,
    "HighChol": 1,
    "CholCheck": 1,
    "BMI": 24.5,
    "Smoker": 0,
    ... (all 21 fields)
  }
}

Response:
{
  "message": "Assessment submitted successfully",
  "assessment": {
    "id": "...",
    "userId": "...",
    "answers": {...},
    "prediction": {
      "risk_level": "low",
      "probability": 0.15,
      "percentage": 15.0,
      "confidence": 85.0
    },
    "createdAt": "2025-11-24T...",
    "updatedAt": "2025-11-24T..."
  }
}
```

### Get My Assessment
```
GET /api/v1/diabetes-assessment/my
Authorization: Bearer <firebase_token>

Response:
{
  "assessment": { ... }
}
```

### Update Specific Answers
```
PUT /api/v1/diabetes-assessment/update
Authorization: Bearer <firebase_token>

Body:
{
  "answers": {
    "BMI": 25.0,
    "PhysActivity": 1
  }
}

Response:
{
  "message": "Assessment answers updated successfully",
  "assessment": { ... }
}
```

## 📱 Frontend Features

### Assessment Flow
1. User taps "Lifestyle Impact" card in Predictions screen
2. Opens questionnaire (21 questions)
3. If user has existing assessment, answers are pre-filled
4. User can navigate back/forward through questions
5. On submit, prediction is calculated
6. Results screen shows:
   - Risk level (Low/Moderate/High)
   - Probability percentage
   - Confidence level
   - Personalized recommendations
   - Action buttons (Find Physician, Review Answers, etc.)

### Key Features
✅ One assessment per user
✅ Can edit answers anytime
✅ Cannot delete assessment
✅ Automatic re-prediction on answer changes
✅ Pre-fills existing answers when reopening
✅ Progress tracking
✅ Validation before submission

## 🔧 Testing

### 1. Start Backend
```powershell
cd C:\GlycoFit\backend
.\.venv\Scripts\activate
python app.py
```

### 2. Place Model Files
Ensure `diabetes_model.pkl` and `diabetes_preprocessor.pkl` are in:
```
C:\GlycoFit\backend\models\
```

### 3. Test Endpoints
Use Postman or curl to test:
- Submit assessment
- Get assessment
- Update answers

### 4. Run Mobile App
```powershell
cd C:\GlycoFit\mobile
npm start
```

## 📝 Database Schema

**Collection:** `diabetes_assessments`

```javascript
{
  "_id": ObjectId("..."),
  "userId": ObjectId("..."),  // Reference to users collection
  "answers": {
    "HighBP": 0,
    "HighChol": 1,
    "CholCheck": 1,
    "BMI": 24.5,
    // ... all 21 fields
  },
  "prediction": {
    "risk_level": "low" | "moderate" | "high",
    "probability": 0.15,      // 0-1
    "percentage": 15.0,       // 0-100
    "confidence": 85.0        // 60-100
  },
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

## 🎯 Next Steps

1. **Place your model files** in `backend/models/`
2. **Restart backend** to load models
3. **Test submission** from mobile app
4. **Verify predictions** are accurate
5. **Monitor logs** for any issues

## ⚠️ Important Notes

- Model files must be trained with the exact 21 features in the specified order
- Preprocessing pipeline should match your training setup
- Firebase authentication is required for all endpoints
- One assessment per user is enforced at database level (upsert)
- Assessment deletion is disabled by design
