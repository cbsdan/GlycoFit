# Comprehensive Diabetes Risk Assessment System

## 🎯 Overview

The **Comprehensive Diabetes Risk Assessment System** is a holistic risk evaluation tool that combines machine learning predictions with real-time lifestyle tracking data to provide users with an evidence-based, actionable diabetes risk score.

### Key Features

✨ **Multi-Source Integration** - Combines 9 different health metrics  
🔬 **Evidence-Based** - Backed by 26+ peer-reviewed scientific studies  
📊 **Weighted Scoring** - Scientifically calibrated component weights  
🎨 **Visual Risk Display** - Color-coded, intuitive UI  
💡 **Personalized Recommendations** - Actionable advice based on individual risk factors  
📈 **Historical Tracking** - Monitor risk changes over time  
🔄 **Real-Time Refresh** - Update assessment after lifestyle changes  

## 📋 System Components

### 1. Risk Factors (9 Components)

| Component | Weight | Data Source | Example Risk |
|-----------|--------|-------------|--------------|
| **Initial Assessment** | 35% | ML model prediction | High: 67%+ prediction |
| **Smoking** | 15% | Smoking tracker | High: Daily smoking |
| **Food Quality** | 13% | Food tracker | High: High sugar, low nutrients |
| **Sleep** | 12% | Sleep tracker | High: <6 hours/night |
| **Physical Activity** | 10% | Step counter | High: <3,000 steps/day |
| **Alcohol** | 8% | Alcohol tracker | High: 14+ drinks/week |
| **BMI** | 5% | User profile | High: BMI ≥30 |
| **Age** | 2% | User profile | High: 60+ years |
| **Sex** | 1% | User profile | Slight: Male |

### 2. Risk Categories

| Category | Score Range | Color | Probability |
|----------|-------------|-------|-------------|
| **Low** | 0-24.9 | 🟢 Green | <25% in 10 years |
| **Moderate** | 25-49.9 | 🟡 Yellow | 25-50% in 10 years |
| **High** | 50-74.9 | 🟠 Orange | 50-75% in 10 years |
| **Very High** | 75-100 | 🔴 Red | >75% in 10 years |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                       │
│              (PredictionScreen.js - React Native)            │
│                                                              │
│  ┌────────────────────┐      ┌──────────────────────────┐  │
│  │ Initial Assessment │      │ Comprehensive Risk Card  │  │
│  │     (ML-based)     │      │   (Multi-source data)    │  │
│  └────────────────────┘      └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕️
┌─────────────────────────────────────────────────────────────┐
│                        API LAYER                             │
│                  (api.js - Service Functions)                │
│                                                              │
│  getOverallRiskAssessment() | refreshOverallRiskAssessment()│
│  getOverallRiskHistory()    | getComponentScores()          │
│  getRiskFactors()                                            │
└─────────────────────────────────────────────────────────────┘
                              ↕️
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND API                             │
│              (Flask - overall_risk_routes.py)                │
│                                                              │
│  GET  /api/v1/risk-assessment/overall                       │
│  POST /api/v1/risk-assessment/overall/refresh               │
│  GET  /api/v1/risk-assessment/overall/history               │
│  GET  /api/v1/risk-assessment/overall/components            │
│  GET  /api/v1/risk-assessment/overall/factors               │
│  GET  /api/v1/risk-assessment/overall/check                 │
└─────────────────────────────────────────────────────────────┘
                              ↕️
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC                            │
│           (comprehensive_risk_service.py)                    │
│                                                              │
│  compute_overall_risk()                                      │
│  ├── _gather_component_data()                               │
│  ├── _score_initial_assessment()                            │
│  ├── _score_sleep()                                          │
│  ├── _score_steps()                                          │
│  ├── _score_smoking()                                        │
│  ├── _score_alcohol()                                        │
│  ├── _score_food()                                           │
│  ├── _score_bmi()                                            │
│  ├── _score_age()                                            │
│  ├── _score_sex()                                            │
│  ├── _calculate_overall_score()                             │
│  ├── _identify_primary_risks()                              │
│  ├── _generate_recommendations()                            │
│  └── _generate_explanation()                                │
└─────────────────────────────────────────────────────────────┘
                              ↕️
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│                    (MongoDB Database)                        │
│                                                              │
│  Collections:                                                │
│  • overall_risk_assessments                                  │
│  • diabetes_assessments                                      │
│  • sleep_metrics                                             │
│  • step_metrics                                              │
│  • smoking_metrics                                           │
│  • alcohol_metrics                                           │
│  • food_intake                                               │
│  • users                                                     │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File Structure

### Backend Files Created

```
backend/
├── models/
│   └── overall_risk_assessment.py          # MongoDB model (270 lines)
├── services/
│   └── comprehensive_risk_service.py       # Core logic (900 lines)
├── controllers/
│   └── overall_risk_controller.py          # API handlers (270 lines)
└── routes/
    └── overall_risk_routes.py              # Route definitions (15 lines)
```

### Frontend Files Modified

```
mobile/
├── services/
│   └── api.js                              # Added 5 API functions
└── screens/
    └── PredictionScreen.js                 # Complete UI integration
```

### Documentation Files

```
root/
├── COMPREHENSIVE_DIABETES_RISK_ASSESSMENT.md     # Scientific documentation
├── COMPREHENSIVE_DIABETES_RISK_IMPLEMENTATION.md # Implementation guide
└── COMPREHENSIVE_RISK_TESTING_GUIDE.md           # Testing procedures
```

## 🚀 Quick Start

### For Developers

1. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```

2. **Frontend Setup**:
   ```bash
   cd mobile
   npm install
   npm start
   ```

3. **Create User & Complete Initial Assessment**:
   - Register/login
   - Navigate to Diabetes Risk Assessment
   - Complete all questions
   - View results on Prediction Screen

4. **Add Lifestyle Data** (optional but recommended):
   - Log sleep data (several days)
   - Log step counts (several days)
   - Log meals with quality scores
   - Return to Prediction Screen

5. **View Comprehensive Assessment**:
   - Navigate to Prediction Screen
   - Comprehensive risk card appears automatically
   - Tap "Refresh" to recompute with latest data

### For Testers

See [COMPREHENSIVE_RISK_TESTING_GUIDE.md](COMPREHENSIVE_RISK_TESTING_GUIDE.md) for detailed testing procedures.

## 📊 How It Works

### 1. Data Collection Phase

The system gathers data from multiple sources:
- **User Profile**: Age, sex, BMI, height, weight
- **Initial Assessment**: ML model prediction (questionnaire-based)
- **Sleep Tracker**: 7-day average sleep duration
- **Step Counter**: 7-day average daily steps
- **Smoking Tracker**: Recent smoking frequency
- **Alcohol Tracker**: Weekly total drinks
- **Food Tracker**: Meal quality scores and nutrient analysis

### 2. Component Scoring Phase

Each component is scored individually (0-100 scale):

**Example: Sleep Scoring**
- Optimal (7-8 hours): 0 points (no risk)
- Suboptimal (6-7 or 8-9 hours): 5-10 points (mild risk)
- Poor (<6 or >9 hours): 15-20 points (high risk)

**Example: Smoking Scoring**
- Never smoked: 0 points
- Quit >1 year: 2 points
- Occasional: 8 points
- Daily: 15 points (maximum risk)

### 3. Weighted Aggregation Phase

Component scores are multiplied by their weights:

```
Overall Score = (Initial × 0.35) + (Smoking × 0.15) + (Food × 0.13) + 
                (Sleep × 0.12) + (Steps × 0.10) + (Alcohol × 0.08) + 
                (BMI × 0.05) + (Age × 0.02) + (Sex × 0.01)
```

**Example Calculation**:
- Initial Assessment: 60 × 0.35 = 21.0
- Smoking (daily): 100 × 0.15 = 15.0
- Food (poor): 70 × 0.13 = 9.1
- Sleep (6 hrs): 50 × 0.12 = 6.0
- Steps (5000): 40 × 0.10 = 4.0
- Alcohol (moderate): 30 × 0.08 = 2.4
- BMI (28): 60 × 0.05 = 3.0
- Age (45): 25 × 0.02 = 0.5
- Sex (male): 50 × 0.01 = 0.5
- **Total: 61.5 → High Risk**

### 4. Risk Factor Identification Phase

The system identifies:
- **Primary Risk Factors**: Components with scores ≥60% (top 3)
- **Protective Factors**: Components with scores <40% (top 3)

### 5. Recommendation Generation Phase

Personalized recommendations are generated based on primary risk factors:
- Priority given to highest-weighted factors
- Actionable and specific advice
- Evidence-based interventions

### 6. Explanation Generation Phase

A detailed explanation is created:
- Overall risk score interpretation
- Component breakdown
- Why certain factors increase/decrease risk
- Data quality and confidence level

## 🎨 User Interface

### Initial Assessment Card

![Initial Assessment](docs/images/initial-assessment-card.png) *(Conceptual)*

Shows ML-based risk prediction with:
- Risk level badge (Low/Moderate/High)
- Percentage and confidence score
- "View Full Report" button

### Comprehensive Risk Card

![Comprehensive Risk](docs/images/comprehensive-risk-card.png) *(Conceptual)*

Shows holistic risk assessment with:
- **Large circular score** (0-100) with color-coded border
- **Risk category badge** with icon
- **Probability statement**
- **Primary risk factors** (red alert icons)
- **Protective factors** (green check icons)
- **Top 3 recommendations** (lightbulb icons)
- **Refresh button** to recompute

### Color Coding

- 🟢 **Green (#27AE60)**: Low risk - Reassuring, positive
- 🟡 **Yellow (#F39C12)**: Moderate risk - Cautionary, alert
- 🟠 **Orange (#E74C3C)**: High risk - Warning, concerning
- 🔴 **Red (#C0392B)**: Very high risk - Urgent, critical

## 🔬 Scientific Foundation

### Evidence Base

All component weights and thresholds are derived from:
- 26 peer-reviewed publications
- Meta-analyses with 100K+ participants
- Longitudinal cohort studies (5-10+ years)
- Hazard ratios and relative risks

### Key Research Citations

1. **Smoking**: Willi et al. 2007 (JAMA) - 44% increased diabetes risk
2. **Sleep**: Knutson et al. 2006 - U-shaped association with diabetes
3. **Physical Activity**: Aune et al. 2015 - Dose-response meta-analysis
4. **Alcohol**: Li et al. 2016 - J-curve effect, moderate protective
5. **Diet**: Malik et al. 2010 - Sugar-sweetened beverages and diabetes

See [COMPREHENSIVE_DIABETES_RISK_ASSESSMENT.md](COMPREHENSIVE_DIABETES_RISK_ASSESSMENT.md) for complete references.

## 📈 Use Cases

### Use Case 1: Newly Diagnosed Prediabetes

**User Profile**:
- 45-year-old male
- BMI 29
- Family history of diabetes
- Just received prediabetes diagnosis

**System Value**:
- Identifies multiple modifiable risk factors
- Provides prioritized recommendations
- Tracks risk reduction over time
- Motivates lifestyle changes with concrete metrics

### Use Case 2: Prevention-Focused Health Enthusiast

**User Profile**:
- 35-year-old female
- Normal BMI
- Active lifestyle
- No diabetes history
- Proactive about health

**System Value**:
- Confirms low risk status
- Identifies protective factors to maintain
- Suggests minor optimizations
- Provides reassurance and validation

### Use Case 3: High-Risk Individual

**User Profile**:
- 58-year-old male
- BMI 34 (obese)
- Daily smoker
- Sedentary job
- Poor diet

**System Value**:
- Quantifies cumulative risk (likely 70-85)
- Prioritizes most impactful interventions
- Shows potential risk reduction from changes
- Facilitates physician consultation

## 🧪 Testing Status

### Backend Testing
- ✅ MongoDB model and indexes
- ✅ API endpoint responses
- ✅ Authentication middleware
- ✅ Error handling
- ⏳ Load testing pending

### Frontend Testing
- ✅ UI rendering
- ✅ Loading states
- ✅ Error states
- ✅ Refresh functionality
- ⏳ Integration testing pending

### Data Integration
- ✅ All 9 components integrate
- ✅ Risk score calculation accuracy
- ✅ Recommendation relevance
- ⏳ Real user scenario testing pending

## 🔐 Security & Privacy

- ✅ Firebase JWT authentication required for all endpoints
- ✅ User data isolation (per-user assessments)
- ✅ No data sharing between users
- ✅ MongoDB indexes for performance
- ✅ Secure password handling
- ✅ HTTPS enforced in production

## 🔄 Future Roadmap

### Phase 1: Enhancement (Q1 2024)
- [ ] Detailed breakdown screen (tap to see all components)
- [ ] Risk trend charts (matplotlib/chart.js)
- [ ] Push notifications for risk changes
- [ ] Background refresh (cron job)

### Phase 2: Intelligence (Q2 2024)
- [ ] Risk trajectory predictions (3, 6, 12 months)
- [ ] Goal setting and tracking
- [ ] Progress analytics dashboard
- [ ] A/B testing for recommendation effectiveness

### Phase 3: Integration (Q3 2024)
- [ ] Wearable device integration (Fitbit, Apple Watch)
- [ ] Physician dashboard access
- [ ] Appointment booking integration
- [ ] Lab result integration (HbA1c, glucose)

### Phase 4: Validation (Q4 2024)
- [ ] Clinical validation study
- [ ] Peer review publication
- [ ] Regulatory compliance review
- [ ] Multi-language support

## 📚 Additional Resources

- **Scientific Documentation**: [COMPREHENSIVE_DIABETES_RISK_ASSESSMENT.md](COMPREHENSIVE_DIABETES_RISK_ASSESSMENT.md)
- **Implementation Details**: [COMPREHENSIVE_DIABETES_RISK_IMPLEMENTATION.md](COMPREHENSIVE_DIABETES_RISK_IMPLEMENTATION.md)
- **Testing Guide**: [COMPREHENSIVE_RISK_TESTING_GUIDE.md](COMPREHENSIVE_RISK_TESTING_GUIDE.md)
- **API Documentation**: See backend/routes/overall_risk_routes.py
- **Database Schema**: See backend/models/overall_risk_assessment.py

## 🤝 Contributing

We welcome contributions! Please:
1. Review the implementation documentation
2. Follow existing code patterns
3. Include tests for new features
4. Update documentation
5. Submit pull requests with clear descriptions

## 📝 License

See [LICENSE](LICENSE) file for details.

## 📞 Support

For questions or issues:
- **Technical**: Review implementation docs first
- **Testing**: See testing guide
- **Bugs**: Use bug report template in testing guide
- **Feature Requests**: Open an issue with detailed description

---

**System Version**: 1.0  
**Last Updated**: 2024  
**Status**: ✅ Implementation Complete, ⏳ Testing In Progress  
**Maintained By**: GlycoFit Development Team  

