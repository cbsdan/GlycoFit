# Comprehensive Diabetes Risk Assessment - Testing Guide

## Quick Start Testing

### Prerequisites
1. Backend running: `python app.py` (Flask server on port 5000)
2. MongoDB running and connected
3. Mobile app running: `npm start` or `expo start`
4. User account created and logged in
5. Initial diabetes assessment completed

## Backend API Testing

### Using cURL (Windows PowerShell)

Replace `YOUR_JWT_TOKEN` with actual Firebase JWT token from login.

#### 1. Get Overall Risk Assessment
```powershell
curl -X GET "http://localhost:5000/api/v1/risk-assessment/overall" `
  -H "Authorization: Bearer YOUR_JWT_TOKEN" `
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "overall_risk_score": 45.2,
    "overall_risk_category": "moderate",
    "category_info": {
      "title": "Moderate Risk",
      "color": "#F39C12",
      "icon": "alert-circle",
      "probability": "25-50% probability within 10 years",
      "message": "You have a moderate risk of developing type 2 diabetes..."
    },
    "component_scores": { ... },
    "primary_risk_factors": [ ... ],
    "protective_factors": [ ... ],
    "recommendations": [ ... ],
    "confidence_level": "high",
    "explanation": "Your overall risk score is...",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 2. Refresh Overall Risk Assessment
```powershell
curl -X POST "http://localhost:5000/api/v1/risk-assessment/overall/refresh" `
  -H "Authorization: Bearer YOUR_JWT_TOKEN" `
  -H "Content-Type: application/json"
```

#### 3. Get Assessment History
```powershell
curl -X GET "http://localhost:5000/api/v1/risk-assessment/overall/history?limit=10" `
  -H "Authorization: Bearer YOUR_JWT_TOKEN" `
  -H "Content-Type: application/json"
```

#### 4. Get Component Scores
```powershell
curl -X GET "http://localhost:5000/api/v1/risk-assessment/overall/components" `
  -H "Authorization: Bearer YOUR_JWT_TOKEN" `
  -H "Content-Type: application/json"
```

#### 5. Get Risk Factors
```powershell
curl -X GET "http://localhost:5000/api/v1/risk-assessment/overall/factors" `
  -H "Authorization: Bearer YOUR_JWT_TOKEN" `
  -H "Content-Type: application/json"
```

#### 6. Check Assessment Exists
```powershell
curl -X GET "http://localhost:5000/api/v1/risk-assessment/overall/check" `
  -H "Authorization: Bearer YOUR_JWT_TOKEN" `
  -H "Content-Type: application/json"
```

### Using Postman

1. **Create New Collection**: "Diabetes Risk Assessment"
2. **Set Authorization**: Bearer Token (use Firebase JWT)
3. **Base URL**: `http://localhost:5000/api/v1/risk-assessment`

**Requests to create**:
- GET `/overall` - Get Overall Assessment
- POST `/overall/refresh` - Refresh Assessment
- GET `/overall/history` - Get History
- GET `/overall/components` - Get Components
- GET `/overall/factors` - Get Factors
- GET `/overall/check` - Check Exists

## Frontend Testing

### Initial Load Test

1. Navigate to Prediction Screen
2. **Verify**: Initial assessment card appears (if assessment exists)
3. **Verify**: Loading indicator shows while fetching data
4. **Verify**: Comprehensive risk card appears (if data available)

### Comprehensive Risk Card Test

When comprehensive risk card is visible:

1. **Score Display**:
   - [ ] Large circular score shows (0-100)
   - [ ] Circle border color matches risk category
   - [ ] Score value is readable and correct

2. **Risk Badge**:
   - [ ] Badge color matches category (green/yellow/orange/red)
   - [ ] Icon displays correctly
   - [ ] Risk category text is clear

3. **Risk Information**:
   - [ ] Probability text is displayed
   - [ ] Risk message is clear and appropriate

4. **Primary Risk Factors**:
   - [ ] Section appears if risk factors exist
   - [ ] Alert icons are red
   - [ ] Component names are readable
   - [ ] Weighted scores display correctly

5. **Protective Factors**:
   - [ ] Section appears if protective factors exist
   - [ ] Check icons are green
   - [ ] Component names are readable
   - [ ] Weighted scores display correctly

6. **Recommendations**:
   - [ ] Up to 3 recommendations display
   - [ ] Lightbulb icons appear
   - [ ] Text is actionable and clear

7. **Refresh Button**:
   - [ ] Button is visible and styled correctly
   - [ ] Tap shows loading indicator
   - [ ] Success alert appears on completion
   - [ ] Card updates with new data

### Error Handling Test

1. **No Internet Connection**:
   - [ ] Appropriate error message shows
   - [ ] App doesn't crash
   - [ ] Retry option available

2. **No Overall Risk Data**:
   - [ ] Initial assessment still displays
   - [ ] No comprehensive card shown (graceful degradation)
   - [ ] No errors logged

3. **API Failure**:
   - [ ] Error alert displays
   - [ ] Previous data remains (if cached)
   - [ ] Can retry operation

### Lifecycle Test

1. **Complete Initial Assessment**:
   - Go to DiabetesRiskAssessment screen
   - Complete all questions
   - Submit assessment
   - Navigate to Prediction Screen
   - [ ] Initial assessment card appears

2. **Add Lifestyle Data**:
   - Log sleep data (several days)
   - Log step counts (several days)
   - Log meals with quality scores
   - Return to Prediction Screen
   - Pull to refresh
   - [ ] Comprehensive risk card appears

3. **Refresh Assessment**:
   - Tap "Refresh Comprehensive Assessment"
   - Wait for completion
   - [ ] Success alert shows
   - [ ] Card updates with new data

4. **Make Lifestyle Changes**:
   - Improve sleep (log 7-8 hours)
   - Increase steps (log 8000+)
   - Reduce smoking/alcohol
   - Tap "Refresh Comprehensive Assessment"
   - [ ] Risk score decreases
   - [ ] Recommendations update

## Scenario Testing

### Scenario 1: Low Risk User

**Setup**:
- Age: 25
- BMI: 22 (normal)
- No smoking
- Moderate alcohol (5 drinks/week)
- Good sleep (7.5 hours average)
- Active (10,000 steps average)
- Healthy diet (nutrient-dense foods)
- Initial assessment: Low risk (20%)

**Expected Overall Score**: 15-25 (Low Risk)

**Expected Display**:
- Green circular border
- "Low Risk" badge in green
- Few or no primary risk factors
- Several protective factors (sleep, steps, BMI, food)
- Recommendations focused on maintenance

### Scenario 2: Moderate Risk User

**Setup**:
- Age: 45
- BMI: 27 (overweight)
- Quit smoking 2 years ago
- Moderate alcohol (8 drinks/week)
- Fair sleep (6 hours average)
- Sedentary (4,000 steps average)
- Average diet
- Initial assessment: Moderate risk (45%)

**Expected Overall Score**: 35-55 (Moderate Risk)

**Expected Display**:
- Yellow circular border
- "Moderate Risk" badge in yellow
- Primary risk factors: BMI, Steps, Sleep
- Some protective factors: Non-smoker
- Recommendations: Increase activity, improve sleep, weight management

### Scenario 3: High Risk User

**Setup**:
- Age: 55
- BMI: 32 (obese)
- Daily smoker
- Heavy alcohol (15 drinks/week)
- Poor sleep (5 hours average)
- Very sedentary (2,000 steps average)
- Poor diet (high sugar, processed foods)
- Initial assessment: High risk (75%)

**Expected Overall Score**: 65-85 (High Risk)

**Expected Display**:
- Orange circular border
- "High Risk" badge in orange
- Multiple primary risk factors: Smoking, BMI, Steps, Sleep, Food, Alcohol
- Few protective factors
- Recommendations: Smoking cessation, weight loss, increase activity, improve diet

### Scenario 4: Insufficient Data

**Setup**:
- Only initial assessment completed
- No lifestyle tracking data
- Basic profile information available

**Expected Behavior**:
- Initial assessment card displays normally
- Comprehensive risk card may not appear
- OR comprehensive risk card shows with "Low Confidence"
- Recommendations encourage using lifestyle trackers

## Database Verification

### MongoDB Compass or Shell

1. **Check Collection Exists**:
```javascript
db.getCollectionNames() // Should include "overall_risk_assessments"
```

2. **Check Index**:
```javascript
db.overall_risk_assessments.getIndexes()
// Should show index on user_id and created_at
```

3. **View Sample Document**:
```javascript
db.overall_risk_assessments.findOne()
```

4. **Count Assessments per User**:
```javascript
db.overall_risk_assessments.aggregate([
  { $group: { _id: "$user_id", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

5. **Check Recent Assessments**:
```javascript
db.overall_risk_assessments.find().sort({ created_at: -1 }).limit(5)
```

## Performance Testing

### Load Time Benchmarks

1. **Initial Load** (Prediction Screen):
   - Target: <2 seconds
   - Measure: From navigation to full render

2. **Refresh Assessment**:
   - Target: <5 seconds
   - Measure: From button tap to success alert

3. **API Response Time**:
   - GET /overall: <500ms
   - POST /overall/refresh: <3 seconds
   - GET /overall/history: <1 second

### Memory Testing

1. Open Prediction Screen
2. Refresh assessment 10 times
3. Navigate away and back 5 times
4. **Verify**: No memory leaks
5. **Verify**: App remains responsive

## Edge Cases

### Edge Case 1: First User Ever
- No initial assessment
- No lifestyle data
- **Expected**: Prompt to take initial assessment

### Edge Case 2: Assessment But No Lifestyle Data
- Initial assessment exists
- No sleep, step, or food data
- **Expected**: Initial card + simplified comprehensive risk (or hidden)

### Edge Case 3: Old Assessment
- Last overall risk assessment >7 days old
- **Expected**: Auto-recomputes on next load

### Edge Case 4: Conflicting Data
- High initial risk (80%) but excellent lifestyle (all optimal)
- **Expected**: Moderate overall risk (50-60%), clear explanation

### Edge Case 5: Rapid Refreshes
- Tap refresh button multiple times quickly
- **Expected**: Prevents duplicate requests, single computation

## Bug Reporting Template

```markdown
## Bug Report

**Screen**: Prediction Screen

**Issue**: [Brief description]

**Steps to Reproduce**:
1. [First step]
2. [Second step]
3. [Result]

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happened]

**Screenshots**: [If applicable]

**Environment**:
- OS: [iOS/Android/Web]
- App Version: [Version number]
- Backend Version: [Version number]
- Device: [Device model]

**Console Logs**:
```
[Paste relevant logs]
```

**Additional Context**: [Any other relevant information]
```

## Success Criteria

✅ **Backend API**:
- All 6 endpoints return correct responses
- Authentication works properly
- Database indexes created successfully
- Error handling covers edge cases

✅ **Frontend Display**:
- All UI elements render correctly
- Colors match risk categories
- Loading states work smoothly
- Error states show appropriate messages

✅ **Data Integration**:
- All 9 components integrate correctly
- Risk scores calculate accurately
- Recommendations are relevant
- Explanations are clear

✅ **User Experience**:
- Navigation is intuitive
- Refresh works smoothly
- No crashes or freezes
- Performance meets benchmarks

## Reporting Results

After testing, document:
1. ✅ Passed tests
2. ⚠️ Failed tests with details
3. 🐛 Bugs discovered
4. 📝 Suggested improvements
5. ⏱️ Performance metrics

---

**Test Guide Version**: 1.0  
**Last Updated**: 2024  
