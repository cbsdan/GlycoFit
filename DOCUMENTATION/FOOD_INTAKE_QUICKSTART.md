# Food Intake Risk Assessment - Quick Start Guide

## What's New

A comprehensive prediabetes risk assessment system based on food intake has been added to GlycoFit. This system evaluates users' risk through:

1. **Baseline Assessment** - 16 research-based questions about eating habits
2. **Daily Food Logging** - Enhanced food scanner with datetime tracking
3. **Risk Calculation** - Combines baseline and daily logs for comprehensive risk score
4. **Personalized Recommendations** - Actionable guidance based on individual patterns

## New Features

### Backend

#### New Files Created:
- `backend/models/food_baseline_assessment.py` - Baseline questionnaire model
- `backend/services/food_tracking_service.py` - Risk calculation and analysis service
- `backend/controllers/food_risk_assessment_controller.py` - API controllers
- `backend/routes/food_risk_routes.py` - API routes

#### Modified Files:
- `backend/models/user_meal.py` - Added support for custom meal_datetime
- `backend/controllers/nutrient_controller.py` - Added meal_datetime parameter
- `backend/app.py` - Registered new food risk routes

### Mobile

#### New Screens:
1. **FoodBaselineScreen.js** - Interactive baseline questionnaire
2. **FoodIntakeScreen.js** - Risk assessment dashboard with visualizations

#### Modified Files:
- `mobile/screens/FoodScannerScreen.js` - Added datetime picker for meal timing
- `mobile/services/api.js` - Updated saveMeal to include meal_datetime
- `mobile/navigation/TabNavigator.js` - Added new screens to navigation
- `mobile/screens/MeasureScreen.js` - Added "Food Intake Risk" card

## API Endpoints

All endpoints are prefixed with `/api/v1/food-risk/`

### 1. Get Baseline Questions
```
GET /baseline/questions
```
Returns 16 research-based questions for the baseline assessment.

### 2. Submit Baseline Assessment
```
POST /baseline/submit
Headers: Authorization: Bearer <token>
Body: {
  "responses": {
    "daily_meal_frequency": 3,
    "skip_breakfast": "Never",
    "late_night_eating": "Rarely (1-2 times/week)",
    ...
  }
}
```
Creates or updates user's baseline assessment and calculates risk score.

### 3. Get User Baseline
```
GET /baseline
Headers: Authorization: Bearer <token>
```
Retrieves user's baseline assessment and responses.

### 4. Get Risk Assessment
```
GET /assessment?days=7
Headers: Authorization: Bearer <token>
```
Returns comprehensive risk assessment combining baseline and daily logs.

Response includes:
- Comprehensive risk score (0-100)
- Risk category (Low, Moderate, High, Very High)
- Breakdown of baseline vs. daily log risk
- Daily nutrient averages
- Total meals analyzed

### 5. Get Personalized Recommendations
```
GET /recommendations
Headers: Authorization: Bearer <token>
```
Returns risk assessment plus personalized recommendations based on user's data.

### 6. Get Daily Log Analysis
```
GET /daily-log-analysis?days=7
Headers: Authorization: Bearer <token>
```
Returns detailed analysis of daily food logs.

## User Flow

### First-Time User:

1. User opens "Food Intake Risk" from Tracker tab
2. Sees empty state with "Start Baseline Assessment" button
3. Completes 16-question baseline assessment
4. Receives initial baseline risk score
5. Logs meals daily using Food Scanner (with datetime selection)
6. After logging meals, returns to "Food Intake Risk" to see comprehensive assessment

### Returning User:

1. Opens "Food Intake Risk" 
2. Sees comprehensive risk dashboard with:
   - Overall risk score with color-coded gradient
   - Breakdown of baseline vs. daily log risk
   - Daily nutrient averages
   - Personalized recommendations
3. Can edit baseline assessment anytime
4. Can log new meals with accurate datetime
5. Risk assessment updates automatically as more meals are logged

## Key Features

### 1. Baseline Assessment
- 16 questions covering meal patterns, food choices, and behaviors
- Questions based on peer-reviewed diabetes research
- Editable at any time
- Risk weights assigned to each question based on research

### 2. Daily Food Logging Enhancement
- Users can now set when they ate (not just when they logged)
- Supports meal pattern analysis (late night eating, meal skipping, etc.)
- More accurate risk assessment based on actual eating times

### 3. Risk Calculation
- **Baseline Risk (40% weight)**: Based on general eating habits
- **Daily Log Risk (60% weight)**: Based on actual food consumption
  - Nutrient-based risk (70%): Calories, carbs, sugars, fiber, fats, sodium, glycemic load
  - Pattern-based risk (30%): Meal timing, frequency, irregularity

### 4. Risk Categories
- **Low (0-24%)**: Minimal risk factors
- **Moderate (25-49%)**: Some concerning patterns
- **High (50-74%)**: Multiple risk factors
- **Very High (75-100%)**: Significant risk

### 5. Personalized Recommendations
High-priority recommendations for:
- Excessive added sugars (>25g/day)
- Low fiber intake (<25g/day)
- High glycemic load (>100)
- Frequent breakfast skipping
- Regular sugary drink consumption
- And more...

## Testing the Feature

### Backend Testing:

1. Start the backend server:
```bash
cd backend
python app.py
```

2. Test the endpoints using a REST client or the mobile app

### Mobile Testing:

1. Install required package:
```bash
cd mobile
npm install @react-native-community/datetimepicker
```

2. Start the mobile app:
```bash
npx expo start
```

3. Navigate to: Tracker → Food Intake Risk

## Important Notes

### Data Requirements:
- Baseline assessment: Complete at least once
- Daily logs: Minimum 1 meal for risk calculation (optimal: 7+ days of data)
- Nutrient data: All key nutrients should be logged (calories, protein, carbs, fat, sugars, fiber, etc.)

### Accuracy Considerations:
- Risk scores are predictive, not diagnostic
- Based on self-reported data
- Should complement, not replace, clinical assessment
- Users with high risk scores should consult healthcare providers

### Privacy:
- All data is user-specific and private
- Stored securely in MongoDB
- Accessible only with Firebase authentication
- Users can delete their data

## Troubleshooting

### Common Issues:

1. **"No Baseline Assessment" screen shows**
   - User needs to complete baseline assessment first
   - Navigate to Food Baseline and complete all questions

2. **Risk score is 0 or very low despite poor diet**
   - May need more daily log data (log meals for several days)
   - Check that all nutrient fields are being captured

3. **Datetime picker not showing on Food Scanner**
   - Ensure @react-native-community/datetimepicker is installed
   - Check Platform.OS compatibility

4. **Recommendations not appearing**
   - Need both baseline assessment and daily logs
   - Check that nutrient values exceed thresholds

## Future Enhancements

Planned improvements include:
- Machine learning for pattern recognition
- Extended nutrient tracking (vitamins, minerals)
- Meal planning suggestions
- Export reports for healthcare providers
- Integration with glucose monitoring devices

## Documentation

For detailed research methodology and implementation details, see:
- [FOOD_INTAKE_RISK_ASSESSMENT.md](./FOOD_INTAKE_RISK_ASSESSMENT.md)

## Support

For questions or issues:
1. Check the comprehensive documentation
2. Review API endpoint documentation in route files
3. Examine research references in the main documentation
4. Check console logs for debugging

---

**Version:** 1.0  
**Date:** January 11, 2026
