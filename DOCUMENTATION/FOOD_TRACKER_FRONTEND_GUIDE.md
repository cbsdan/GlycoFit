# Food Tracker Frontend - Detailed Assessment Display

## Overview
The Food Tracker screen now displays comprehensive food risk assessment with detailed explanations, helping users understand their prediabetes risk and how to improve it.

## Features Implemented

### 1. **Main Risk Score Display**
- Large, color-coded gradient card showing overall risk percentage (0-100%)
- Risk category badge (Low/Moderate/High/Very High)
- Clear risk message explaining what the score means

### 2. **Understanding Your Risk (Expandable)**
- **WHY**: Research-based explanation of what the risk category means
- **WHAT**: Specific behaviors or patterns affecting the score  
- **TIP**: Actionable advice to reduce risk
- Icon: 💡 Lightbulb
- Tap to expand/collapse

### 3. **Risk Breakdown**
- **Baseline Assessment**: Score from 16-question eating habits questionnaire (40% weight)
- **Daily Log Analysis**: Score from actual food intake over 7 days (60% weight)
- Visual progress bars showing each component
- Meal count statistics (e.g., "Analysis of 42 meals over 7 days")
- **Data Quality Warnings**: 
  - Orange alert if logging < 2 meals/day ("Limited data - log more meals")
  - Red alert if insufficient data

### 4. **Top Risk Factors (Expandable)**
- Shows up to 10 highest-contributing baseline questions
- Each item displays:
  - Question text (e.g., "How often do you consume sugary drinks?")
  - User's answer (e.g., "More than 3 times per day")
  - Risk contribution score (e.g., "+8.5%")
  - **Why it matters**: Research explanation
  - **Quick tip**: Specific action to take
- Color-coded scores (red = high contribution)
- Icon: ⚠️ Alert circle
- Tap to expand/collapse

### 5. **Nutrient Analysis (Expandable)**
- Detailed breakdown of 8 key nutrients:
  - Calories
  - Carbohydrates
  - Sugar
  - Saturated Fat
  - Trans Fat
  - Fiber
  - Protein
  - Sodium
- Each nutrient shows:
  - **Status badge**: GOOD (green) / WARNING (orange) / DANGER (red)
  - **Your average**: Daily average from logged meals
  - **Target**: Recommended daily intake
  - **Research explanation**: Why this nutrient affects diabetes risk
  - **Practical tip**: Food swaps and portion advice
- Icon: 🥗 Nutrition
- Tap to expand/collapse

### 6. **Personalized Recommendations**
- Priority-based recommendations (High/Medium/Low)
- Each recommendation includes:
  - Category (e.g., "Reduce Added Sugar")
  - Specific message with user's actual data
  - Priority badge (color-coded)
  - Actionable steps
- Sorted by priority (High → Medium → Low)

## User Experience Flow

### First Time Users
1. See "Welcome to Food Tracker" screen
2. Prompted to complete baseline assessment (16 questions, 2-3 minutes)
3. Tap "Start Baseline Assessment" → Navigate to FoodBaselineScreen
4. Complete assessment and return to tracker
5. See "Start Logging Meals" prompt
6. Tap "Scan & Log Food" to scan first meal

### Returning Users with Data
1. Pull-to-refresh to update assessment
2. See overall risk score at a glance
3. Tap expandable sections to learn more:
   - **Understanding Your Risk**: General education about risk level
   - **Top Risk Factors**: What specific habits are increasing risk
   - **Nutrient Analysis**: Which nutrients need attention
4. Read recommendations and take action
5. Tap "Scan & Log Food" to log more meals
6. Tap pencil icon to edit baseline answers

## Color Coding System

### Risk Scores
- **Low (0-24%)**: Green gradient (#66BB6A → #4CAF50)
- **Moderate (25-49%)**: Orange gradient (#FFA726 → #FF9800)
- **High (50-74%)**: Red-orange gradient (#FF7043 → #FF5722)
- **Very High (75-100%)**: Dark red gradient (#E57373 → #D32F2F)

### Nutrient Status
- **GOOD**: Green background (#E8F5E9) with green text (#4CAF50)
- **WARNING**: Orange background (#FFF3E0) with orange text (#FF9800)
- **DANGER**: Red background (#FFEBEE) with red text (#F44336)

### Priority Badges
- **High**: Red (#D32F2F)
- **Medium**: Orange (#FF9800)
- **Low**: Blue (#2196F3)

## Data Quality Indicators

### Good Quality
- ✅ At least 2 meals logged per day
- ✅ Consistent logging over analysis period
- No warnings shown

### Partial Quality
- ⚠️ Orange warning: "Limited data - log more meals for accurate assessment"
- Some days with < 2 meals logged
- Risk score may be less accurate

### Insufficient Quality
- 🚨 Red alert: "Insufficient data - please log at least 2 meals per day"
- Very few meals logged
- Risk score defaults to baseline (doesn't reward non-logging)

## API Integration

### Endpoint Used
```javascript
const response = await api.getDetailedFoodAssessment(7); // 7 days
```

### Response Structure
```javascript
{
  success: true,
  data: {
    overall_risk: {
      score: 62.5,
      category: "High",
      message: "Your eating habits indicate elevated diabetes risk...",
      explanation: {
        why: "Research shows...",
        what: "Specific patterns...",
        tip: "Actionable advice..."
      }
    },
    baseline_assessment: {
      score: 55.0,
      top_contributors: [
        {
          question: "How often do you consume sugary drinks?",
          user_answer: "More than 3 times per day",
          contribution: 8.5,
          explanation: { why: "...", what: "...", tip: "..." }
        }
        // ... more contributors
      ]
    },
    daily_log_assessment: {
      score: 68.0,
      days_analyzed: 7,
      total_meals: 42,
      data_quality: "good", // or "partial" or "insufficient"
      nutrient_analysis: [
        {
          nutrient: "sugar",
          average: 85.5,
          recommended: 25.0,
          unit: "g",
          status: "danger",
          explanation: { why: "...", what: "...", tip: "..." }
        }
        // ... 7 more nutrients
      ]
    },
    recommendations: [
      {
        category: "Reduce Added Sugar",
        message: "Your daily sugar intake (85.5g) is significantly higher...",
        priority: "High"
      }
      // ... more recommendations
    ]
  }
}
```

## State Management

### Component State
```javascript
const [expandedSections, setExpandedSections] = useState({
  explanation: false,    // Understanding Your Risk
  contributors: false,   // Top Risk Factors
  nutrients: false,      // Nutrient Analysis
});
```

### Toggle Function
```javascript
const toggleSection = (section) => {
  setExpandedSections(prev => ({
    ...prev,
    [section]: !prev[section]
  }));
};
```

## Accessibility Features

1. **Touch Targets**: All expandable cards have full-width touch areas
2. **Visual Feedback**: `activeOpacity={0.7}` on tap
3. **Clear Icons**: 
   - Chevron up/down indicates expandable state
   - Section icons help identify content type
4. **Color Independence**: Not relying solely on color (includes text + icons)
5. **Readable Font Sizes**: Minimum 13px for body text
6. **Contrast**: All text meets WCAG AA standards

## Performance Optimizations

1. **Single API Call**: One endpoint returns all data (baseline + daily logs + recommendations)
2. **Lazy Rendering**: Expandable sections only render content when expanded
3. **Pull-to-Refresh**: Prevents unnecessary API calls
4. **Smart Loading**: Shows cached data while refreshing

## Error Handling

### No Baseline
- Shows welcome screen with "Start Baseline Assessment" button
- Explains what baseline assessment is (16 questions, 2-3 minutes)
- Provides value proposition ("research-based", "edit anytime")

### No Meal Data
- Shows "Start Logging Meals" card
- Explains that risk assessment will appear once meals are logged
- Prominent "Scan & Log Food" button

### API Errors
- Silent failure (no error toast)
- Prevents showing misleading "0%" risk
- Cached data remains visible during refresh failures

## Testing Checklist

### Visual Testing
- ✅ Risk score displays correct color for each range
- ✅ Expandable sections animate smoothly
- ✅ Icons align properly with text
- ✅ Text wraps correctly on small screens
- ✅ Badges and pills render with correct colors

### Functional Testing
- ✅ Pull-to-refresh updates data
- ✅ Tapping expandable cards toggles content
- ✅ Navigation to FoodBaseline works
- ✅ Navigation to FoodScanner works
- ✅ Data quality warnings appear when needed
- ✅ All nutrient units display correctly (g, mg, kcal)

### Data Testing
- ✅ Scores calculate correctly (40% baseline + 60% daily)
- ✅ Top contributors sorted by impact
- ✅ Nutrient analysis shows all 8 nutrients
- ✅ Recommendations prioritized correctly

### Edge Cases
- ✅ No baseline → shows welcome screen
- ✅ Baseline but no meals → shows "start logging" message
- ✅ < 2 meals/day → shows warning
- ✅ Exactly 0 meals → defaults to baseline risk
- ✅ All nutrients in "good" range → shows positive message

## Future Enhancements (Optional)

1. **Progress Tracking**: 
   - Show historical trends (risk score over time)
   - "Your score improved by 12% this month!"

2. **Meal Reminders**:
   - Smart notifications if user hasn't logged in 24 hours
   - "Log your breakfast to maintain accurate tracking"

3. **Food Database Integration**:
   - Allow manual food search/entry
   - Barcode scanning for packaged foods

4. **Social Features**:
   - Share achievements ("30 days of healthy eating!")
   - Community recipes and tips

5. **AI Insights**:
   - Pattern detection ("You tend to consume more sugar on weekends")
   - Predictive recommendations ("Based on your history, try...")

6. **Export Data**:
   - Download food diary as PDF
   - Share with healthcare provider

## Screenshots Layout

```
┌─────────────────────────┐
│  ← Food Tracker      ✏️ │ ← Header with back & edit
├─────────────────────────┤
│                         │
│  📷 Scan & Log Food  →  │ ← Prominent action button
│                         │
├─────────────────────────┤
│   Your Prediabetes Risk │
│         62.5%           │ ← Gradient card
│      [High Risk]        │
│  ℹ️ Your eating habits  │
│     indicate elevated...│
└─────────────────────────┘
┌─────────────────────────┐
│ 💡 Understanding Your   │
│    Risk              ▼  │ ← Tap to expand
└─────────────────────────┘
┌─────────────────────────┐
│     Risk Breakdown      │
│                         │
│ 📋 Baseline Assessment  │
│ ████████░░ 55.0%        │
│                         │
│ 🍎 Daily Log (7 days)   │
│ ████████████░ 68.0%     │
│ ⚠️ Limited data - log   │
│    more meals           │
│                         │
│ 📊 42 meals, 7 days     │
└─────────────────────────┘
┌─────────────────────────┐
│ ⚠️ Top Risk Factors (8) │
│                      ▼  │ ← Tap to expand
└─────────────────────────┘
┌─────────────────────────┐
│ 🥗 Nutrient Analysis    │
│                      ▼  │ ← Tap to expand
└─────────────────────────┘
┌─────────────────────────┐
│ Personalized            │
│ Recommendations         │
│                         │
│ ┃ Reduce Added Sugar    │
│ ┃ [High]                │
│ ┃ Your daily sugar...   │
│                         │
│ ┃ Increase Fiber        │
│ ┃ [Medium]              │
│ ┃ You're consuming...   │
└─────────────────────────┘
```

## Developer Notes

### File Modified
- `mobile/screens/FoodTrackerScreen.js` (605 → ~750 lines)

### New State Variables
- `expandedSections` object with 3 boolean flags

### New Helper Function
- `toggleSection(section)` for expanding/collapsing

### API Service Method
- `api.getDetailedFoodAssessment(days)` in `mobile/services/api.js`

### Styling Additions
- 20+ new StyleSheet entries for expandable components
- Responsive widths using Dimensions
- Color-coded badges and status indicators

### Dependencies
- No new dependencies required
- Uses existing: `react-native-vector-icons/MaterialCommunityIcons`, `expo-linear-gradient`

## Support

For questions or issues:
1. Check backend logs: `python app.py` in `/backend`
2. Check mobile console: Metro bundler logs
3. Verify API endpoint: `GET /api/v1/food-risk/detailed-assessment?days=7`
4. Review complete implementation: `FOOD_RISK_ASSESSMENT_IMPROVEMENTS.md`
