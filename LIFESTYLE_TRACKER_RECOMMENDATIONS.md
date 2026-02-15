# Lifestyle Tracker Recommendation System

## Overview

This document outlines the research-based implementation of the **Lifestyle Tracker Recommendation System** for GlycoFit. The system provides:

1. **Pattern Analysis**: Analyzes user behavior patterns across all lifestyle trackers
2. **Timeline Predictions**: Predicts health outcomes if current patterns continue
3. **Personalized Recommendations**: Provides evidence-based recommendations for improvement
4. **Healthy Defaults**: Recommends healthy behaviors when insufficient data is available

---

## Table of Contents

1. [Research Foundation](#research-foundation)
2. [Food Tracker Recommendations](#1-food-tracker-recommendations)
3. [Sleep Tracker Recommendations](#2-sleep-tracker-recommendations)
4. [Step Counter Recommendations](#3-step-counter-recommendations)
5. [Alcohol Intake Recommendations](#4-alcohol-intake-recommendations)
6. [Smoking Intake Recommendations](#5-smoking-intake-recommendations)
7. [Implementation Architecture](#implementation-architecture)
8. [API Reference](#api-reference)

---

## Research Foundation

### Key Studies Referenced

| Study | Year | Journal | Key Finding |
|-------|------|---------|-------------|
| Knowler et al. (DPP) | 2002 | NEJM | Lifestyle intervention reduced T2D incidence by 58% |
| Lindström et al. (Finnish DPS) | 2006 | Lancet | Sustained lifestyle changes prevent diabetes for years |
| Cappuccio et al. | 2010 | Diabetes Care | Short sleep increases T2D risk by 28% |
| Kraus et al. | 2019 | JAMA | Physical activity reduces all-cause mortality |
| Baliunas et al. | 2009 | Diabetes Care | Heavy drinking increases T2D risk by 43% |
| Willi et al. | 2007 | JAMA | Smoking increases T2D risk by 44% |

### Risk Calculation Philosophy

```
Timeline Prediction = Current Pattern × Duration Factor × Cumulative Risk Modifier
```

Where:
- **Current Pattern**: User's recent behavior (7-30 days)
- **Duration Factor**: How long pattern has been sustained
- **Cumulative Risk Modifier**: Compound effect of sustained behavior

---

## 1. Food Tracker Recommendations

### 1.1 Research Basis

**Diabetes Prevention Program (DPP) Study (2002)**:
- Dietary intervention achieving 7% weight loss reduced T2D incidence by 58%
- Key dietary factors: reduced calories, reduced fat (<25% of calories), increased fiber

**Finnish Diabetes Prevention Study (2003)**:
- Moderate fat reduction + increased fiber → 58% risk reduction
- Effects sustained for 7+ years after intervention

### 1.2 Risk Factors & Timeline Predictions

#### High Glycemic Load Pattern

| Duration | Health Impact | Research Reference |
|----------|---------------|-------------------|
| 1 month | Increased insulin demand, postprandial glucose spikes | ADA Guidelines 2024 |
| 3 months | Beginning of insulin resistance markers | Barclay et al., 2008 |
| 6 months | Elevated HbA1c risk (+0.3-0.5%) | Brand-Miller et al., 2003 |
| 1 year | 15-20% increased T2D risk | Villegas et al., 2007 |
| 5 years | 40-50% increased T2D risk | Salmeron et al., 1997 |

**Prediction Algorithm**:
```python
def predict_glycemic_impact(avg_glycemic_load, duration_days):
    """
    Predicts health impact of sustained high glycemic load.
    
    Based on:
    - Villegas et al., 2007: Shanghai Women's Health Study
    - Salmeron et al., 1997: Nurses' Health Study
    """
    if avg_glycemic_load <= 100:
        return {"risk_increase": 0, "message": "Optimal glycemic load"}
    
    # Risk increases logarithmically with time
    base_risk = (avg_glycemic_load - 100) / 100  # Excess GL as factor
    time_factor = math.log10(max(duration_days, 1) + 1) / 3
    
    risk_increase = base_risk * time_factor * 0.15  # 15% max per unit excess
    
    return {
        "risk_increase": min(risk_increase, 0.50),  # Cap at 50%
        "timeline_months": duration_days / 30,
        "projected_hba1c_change": risk_increase * 0.5,  # Approx HbA1c impact
        "research_basis": "Villegas et al., 2007; Salmeron et al., 1997"
    }
```

#### Low Fiber Intake Pattern

| Duration | Health Impact | Research Reference |
|----------|---------------|-------------------|
| 1 month | Reduced gut microbiome diversity | Sonnenburg & Bäckhed, 2016 |
| 3 months | Increased postprandial glucose | Weickert & Pfeiffer, 2018 |
| 6 months | Elevated inflammatory markers | King et al., 2012 |
| 1 year | 10-15% increased T2D risk | InterAct Consortium, 2015 |

**Recommendations Based on Pattern**:

```javascript
const fiberRecommendations = {
    insufficient_data: [
        {
            title: "Start tracking your fiber intake",
            message: "Aim for 25-30g of fiber daily from whole grains, vegetables, and legumes.",
            research: "ADA Standards of Care 2024 recommend 14g fiber per 1000 kcal",
            actionable_tips: [
                "Add vegetables to every meal",
                "Choose whole grain over refined grains",
                "Include legumes 2-3 times per week",
                "Snack on fruits and nuts"
            ]
        }
    ],
    low_fiber: [
        {
            title: "Increase fiber intake gradually",
            message: "Your current fiber intake puts you at higher risk. Increase by 5g per week.",
            timeline_risk: "If continued for 1 year: 10-15% increased T2D risk",
            research: "InterAct Consortium, 2015",
            actionable_tips: [
                "Replace white rice with brown rice or quinoa",
                "Add chia seeds or flaxseeds to breakfast",
                "Include a salad with lunch and dinner"
            ]
        }
    ],
    adequate_fiber: [
        {
            title: "Great fiber intake!",
            message: "You're meeting fiber recommendations. Keep it up!",
            protective_effect: "May reduce T2D risk by 15-30%",
            research: "Weickert & Pfeiffer, 2018"
        }
    ]
};
```

### 1.3 Food Tracker API Response Structure

```json
{
    "success": true,
    "data": {
        "current_risk_score": 45,
        "risk_category": "moderate",
        "timeline_predictions": {
            "3_months": {
                "projected_risk": 48,
                "key_factors": ["high_glycemic_load", "low_fiber"],
                "research_basis": "Based on DPP and Finnish DPS studies"
            },
            "6_months": {
                "projected_risk": 52,
                "potential_hba1c_change": "+0.2%",
                "research_basis": "Brand-Miller et al., 2003"
            },
            "1_year": {
                "projected_risk": 58,
                "potential_hba1c_change": "+0.4%",
                "intervention_impact": "Dietary changes now could prevent this"
            }
        },
        "recommendations": [
            {
                "category": "Glycemic Load",
                "priority": "high",
                "title": "Reduce high-glycemic foods",
                "message": "Your average glycemic load is 145 (optimal: <100)",
                "timeline_impact": "If continued: +20% T2D risk in 1 year",
                "actionable_tips": [
                    "Replace white bread with whole grain bread",
                    "Choose steel-cut oats over instant oatmeal",
                    "Add protein to carbohydrate-rich meals"
                ],
                "research": "Villegas et al., 2007"
            }
        ],
        "healthy_defaults": {
            "message": "When data is insufficient, follow these guidelines",
            "guidelines": [
                "Eat 5+ servings of vegetables daily",
                "Choose whole grains over refined grains",
                "Limit added sugars to <25g daily",
                "Include protein with every meal"
            ]
        }
    }
}
```

---

## 2. Sleep Tracker Recommendations

### 2.1 Research Basis

**Meta-Analysis by Cappuccio et al. (2010)**:
- Short sleep (<6h) increases T2D risk by 28%
- Long sleep (>9h) increases T2D risk by 48%
- Optimal: 7-8 hours per night

**Sleep Regularity Study (Huang et al., 2020)**:
- High sleep variability (>90 min SD) increases metabolic risk by 27%
- Regular sleep timing improves insulin sensitivity

### 2.2 Risk Factors & Timeline Predictions

#### Short Sleep Pattern (<6 hours)

| Duration | Health Impact | Research Reference |
|----------|---------------|-------------------|
| 1 week | Decreased insulin sensitivity by 16% | Spiegel et al., 1999 |
| 1 month | Elevated cortisol, increased appetite | Taheri et al., 2004 |
| 3 months | Chronic inflammation markers elevated | Irwin et al., 2016 |
| 6 months | Significant insulin resistance | Buxton et al., 2012 |
| 1 year | 28% increased T2D risk | Cappuccio et al., 2010 |

**Prediction Algorithm**:
```python
def predict_sleep_impact(avg_sleep_hours, duration_days, variability_hours=None):
    """
    Predicts health impact of sustained sleep patterns.
    
    Based on:
    - Cappuccio et al., 2010: Meta-analysis of prospective studies
    - Huang et al., 2020: Sleep regularity study
    """
    predictions = {
        "current_pattern": {
            "avg_hours": avg_sleep_hours,
            "days_tracked": duration_days,
            "variability": variability_hours
        },
        "risk_factors": [],
        "timeline_predictions": {}
    }
    
    # Short sleep impact
    if avg_sleep_hours < 6:
        time_factor = min(duration_days / 365, 1)  # Cap at 1 year
        risk_increase = 0.28 * time_factor  # 28% max risk increase
        
        predictions["risk_factors"].append({
            "factor": "short_sleep",
            "current_risk_increase": risk_increase,
            "research": "Cappuccio et al., 2010"
        })
        
        predictions["timeline_predictions"] = {
            "1_week": {
                "impact": "Insulin sensitivity may decrease by 16%",
                "research": "Spiegel et al., 1999"
            },
            "1_month": {
                "impact": "Increased cortisol and appetite hormones",
                "research": "Taheri et al., 2004"
            },
            "6_months": {
                "impact": "Significant insulin resistance likely",
                "research": "Buxton et al., 2012"
            },
            "1_year": {
                "impact": "28% increased T2D risk",
                "research": "Cappuccio et al., 2010"
            }
        }
    
    # Variability impact (only if 14+ days tracked)
    if variability_hours and duration_days >= 14:
        if variability_hours > 1.5:
            predictions["risk_factors"].append({
                "factor": "high_variability",
                "current_risk_increase": 0.27 * (variability_hours - 1) / 2,
                "research": "Huang et al., 2020"
            })
    
    return predictions
```

### 2.3 Sleep Recommendations

```javascript
const sleepRecommendations = {
    insufficient_data: [
        {
            title: "Track your sleep for better insights",
            message: "We need at least 7 days of sleep data for accurate recommendations.",
            healthy_guidelines: [
                "Aim for 7-8 hours of sleep per night",
                "Keep a consistent bedtime (±30 minutes)",
                "Avoid screens 1 hour before bed",
                "Keep bedroom cool (65-68°F/18-20°C)"
            ],
            research: "American Academy of Sleep Medicine Guidelines"
        }
    ],
    short_sleep: [
        {
            title: "Your sleep duration is too short",
            message: "Averaging less than 6 hours increases diabetes risk significantly.",
            timeline_impact: {
                "1_month": "Insulin sensitivity decreases, appetite increases",
                "6_months": "Chronic metabolic changes begin",
                "1_year": "28% increased T2D risk"
            },
            improvement_tips: [
                "Go to bed 15 minutes earlier each week",
                "Set a consistent wake time",
                "Limit caffeine after 2 PM",
                "Create a relaxing bedtime routine"
            ],
            research: "Cappuccio et al., 2010"
        }
    ],
    irregular_sleep: [
        {
            title: "Your sleep schedule varies significantly",
            message: "Sleep time variability >90 minutes increases metabolic risk.",
            timeline_impact: "Continued irregularity may increase T2D risk by 27%",
            improvement_tips: [
                "Set consistent bed and wake times (even weekends)",
                "Use sleep alarms to remind you to go to bed",
                "Avoid large variations on weekends"
            ],
            research: "Huang et al., 2020"
        }
    ],
    optimal_sleep: [
        {
            title: "Excellent sleep habits!",
            message: "Your 7-8 hours of consistent sleep supports metabolic health.",
            protective_effect: "Optimal sleep may reduce T2D risk compared to short sleepers",
            maintenance_tips: [
                "Continue your consistent sleep schedule",
                "Monitor for changes during stressful periods"
            ]
        }
    ]
};
```

---

## 3. Step Counter Recommendations

### 3.1 Research Basis

**JAMA Study by Kraus et al. (2019)**:
- 7,000-8,000 steps/day associated with 50-65% lower mortality risk
- Benefits plateau around 10,000 steps/day

**Physical Activity Guidelines Advisory Committee (2018)**:
- Any amount of physical activity provides health benefits
- 150-300 minutes moderate activity per week optimal

### 3.2 Risk Factors & Timeline Predictions

#### Sedentary Pattern (<5,000 steps/day)

| Duration | Health Impact | Research Reference |
|----------|---------------|-------------------|
| 1 week | Decreased insulin sensitivity | Thyfault & Krogh-Madsen, 2011 |
| 2 weeks | Increased visceral fat accumulation | Olsen et al., 2008 |
| 1 month | Elevated fasting glucose | Mikus et al., 2012 |
| 3 months | Reduced cardiovascular fitness | Krogh-Madsen et al., 2010 |
| 6 months | 15-20% increased T2D risk | Grøntved & Hu, 2011 |
| 1 year | 30% increased T2D risk | Patterson et al., 2018 |

**Prediction Algorithm**:
```python
def predict_activity_impact(avg_daily_steps, duration_days, consistency_percent=None):
    """
    Predicts health impact of sustained activity levels.
    
    Based on:
    - Kraus et al., 2019: Step count and mortality study
    - Patterson et al., 2018: Sedentary behavior and diabetes
    """
    predictions = {
        "current_pattern": {
            "avg_steps": avg_daily_steps,
            "days_tracked": duration_days,
            "consistency": consistency_percent
        },
        "activity_category": "",
        "timeline_predictions": {},
        "recommendations": []
    }
    
    # Categorize activity level
    if avg_daily_steps < 3000:
        predictions["activity_category"] = "highly_sedentary"
        base_risk_factor = 0.35  # 35% increased risk
    elif avg_daily_steps < 5000:
        predictions["activity_category"] = "sedentary"
        base_risk_factor = 0.25  # 25% increased risk
    elif avg_daily_steps < 7500:
        predictions["activity_category"] = "light_active"
        base_risk_factor = 0.10  # 10% increased risk
    elif avg_daily_steps < 10000:
        predictions["activity_category"] = "active"
        base_risk_factor = 0  # Baseline
    else:
        predictions["activity_category"] = "highly_active"
        base_risk_factor = -0.10  # 10% risk reduction
    
    # Time-weighted risk
    time_factor = min(duration_days / 365, 1)
    current_risk = base_risk_factor * time_factor
    
    predictions["current_risk_modification"] = current_risk
    
    # Timeline predictions for sedentary
    if avg_daily_steps < 5000:
        predictions["timeline_predictions"] = {
            "1_week": {
                "impact": "Insulin sensitivity may decrease by 10-15%",
                "reversible": True,
                "research": "Thyfault & Krogh-Madsen, 2011"
            },
            "1_month": {
                "impact": "Elevated fasting glucose likely",
                "reversible": True,
                "research": "Mikus et al., 2012"
            },
            "6_months": {
                "impact": "15-20% increased T2D risk",
                "partially_reversible": True,
                "research": "Grøntved & Hu, 2011"
            },
            "1_year": {
                "impact": "30% increased T2D risk",
                "intervention_needed": True,
                "research": "Patterson et al., 2018"
            }
        }
    
    return predictions
```

### 3.3 Step Recommendations

```javascript
const stepRecommendations = {
    insufficient_data: [
        {
            title: "Start tracking your daily steps",
            message: "Regular step tracking helps monitor your activity levels.",
            healthy_guidelines: [
                "Aim for 7,000-10,000 steps daily",
                "Take walking breaks every hour",
                "Use stairs instead of elevators",
                "Park further away from destinations"
            ],
            research: "Physical Activity Guidelines Advisory Committee, 2018"
        }
    ],
    highly_sedentary: [
        {
            title: "Your activity level is very low",
            message: "Less than 3,000 steps/day significantly increases health risks.",
            timeline_impact: {
                "1_week": "Decreased insulin sensitivity",
                "1_month": "Elevated fasting glucose",
                "6_months": "20% increased T2D risk",
                "1_year": "35% increased T2D risk"
            },
            progressive_goals: [
                "Week 1: Add 500 steps daily (walk 5 minutes more)",
                "Week 2: Add 1,000 steps daily total",
                "Week 4: Aim for 5,000 steps daily",
                "Month 2: Work toward 7,000 steps daily"
            ],
            research: "Patterson et al., 2018"
        }
    ],
    sedentary: [
        {
            title: "Increase your daily movement",
            message: "Your current activity level puts you at moderate risk.",
            timeline_impact: "Continued sedentary behavior may increase T2D risk by 25% over 1 year",
            improvement_tips: [
                "Take a 10-minute walk after each meal",
                "Set hourly reminders to stand and move",
                "Try a standing desk for part of the day",
                "Walk during phone calls"
            ],
            research: "Kraus et al., 2019"
        }
    ],
    active: [
        {
            title: "Great activity level!",
            message: "Your step count supports metabolic health.",
            protective_effect: "7,000-10,000 steps/day associated with 50% lower mortality risk",
            maintenance_tips: [
                "Maintain consistency throughout the week",
                "Consider adding strength training 2x/week",
                "Track trends to catch decreases early"
            ],
            research: "Kraus et al., 2019"
        }
    ]
};
```

---

## 4. Alcohol Intake Recommendations

### 4.1 Research Basis

**Meta-Analysis by Baliunas et al. (2009)**:
- Light drinking (≤3 drinks/week): Potentially protective (0.95x risk)
- Heavy drinking (>14 drinks/week men, >7 women): 43% increased T2D risk
- Binge drinking: Acute glucose dysregulation

**NIAAA Guidelines**:
- Moderate: ≤2 drinks/day men, ≤1 drink/day women
- Heavy: >4 drinks/day men, >3 drinks/day women
- Binge: ≥5 drinks (men), ≥4 drinks (women) in 2 hours

### 4.2 Risk Factors & Timeline Predictions

#### Heavy Drinking Pattern

| Duration | Health Impact | Research Reference |
|----------|---------------|-------------------|
| 1 week | Acute blood glucose fluctuations | Steiner et al., 2015 |
| 1 month | Liver enzyme elevation | Rehm et al., 2010 |
| 3 months | Beginning of fatty liver changes | Zakhari & Li, 2007 |
| 6 months | Chronic inflammation, insulin resistance | Kim et al., 2019 |
| 1 year | 43% increased T2D risk | Baliunas et al., 2009 |
| 5 years | Significantly elevated cardiovascular risk | Roerecke & Rehm, 2014 |

**Prediction Algorithm**:
```python
def predict_alcohol_impact(drinks_per_week, binge_episodes_monthly, duration_days, gender='male'):
    """
    Predicts health impact of sustained alcohol consumption patterns.
    
    Based on:
    - Baliunas et al., 2009: Diabetes Care meta-analysis
    - NIAAA drinking guidelines
    """
    predictions = {
        "current_pattern": {
            "drinks_per_week": drinks_per_week,
            "binge_episodes": binge_episodes_monthly,
            "days_tracked": duration_days
        },
        "risk_category": "",
        "timeline_predictions": {},
        "recommendations": []
    }
    
    # Determine risk category based on gender-specific thresholds
    heavy_threshold = 14 if gender == 'male' else 7
    moderate_threshold = 7 if gender == 'male' else 4
    
    if drinks_per_week == 0:
        predictions["risk_category"] = "none"
        risk_multiplier = 1.0
    elif drinks_per_week <= 3:
        predictions["risk_category"] = "light"
        risk_multiplier = 0.95  # Slightly protective
    elif drinks_per_week <= moderate_threshold:
        predictions["risk_category"] = "moderate"
        risk_multiplier = 1.0
    elif drinks_per_week <= heavy_threshold:
        predictions["risk_category"] = "heavy"
        risk_multiplier = 1.43  # 43% increased risk
    else:
        predictions["risk_category"] = "very_heavy"
        risk_multiplier = 1.55  # 55% increased risk
    
    # Binge drinking adds additional risk
    if binge_episodes_monthly >= 1:
        predictions["has_binge_risk"] = True
        risk_multiplier += 0.12  # Additional 12% risk
    
    # Time-weighted risk
    time_factor = min(duration_days / 365, 1)
    current_risk_increase = (risk_multiplier - 1) * time_factor
    
    predictions["risk_multiplier"] = risk_multiplier
    predictions["current_risk_increase"] = current_risk_increase
    
    # Timeline predictions for heavy drinkers
    if predictions["risk_category"] in ["heavy", "very_heavy"]:
        predictions["timeline_predictions"] = {
            "1_month": {
                "impact": "Liver enzyme elevation likely",
                "reversible": True,
                "research": "Rehm et al., 2010"
            },
            "3_months": {
                "impact": "Early fatty liver changes may occur",
                "reversible": True,
                "research": "Zakhari & Li, 2007"
            },
            "6_months": {
                "impact": "Chronic inflammation and insulin resistance",
                "partially_reversible": True,
                "research": "Kim et al., 2019"
            },
            "1_year": {
                "impact": "43% increased T2D risk",
                "research": "Baliunas et al., 2009"
            }
        }
    
    return predictions
```

### 4.3 Alcohol Recommendations

```javascript
const alcoholRecommendations = {
    insufficient_data: [
        {
            title: "Track your alcohol intake",
            message: "Monitoring alcohol consumption helps assess diabetes risk.",
            healthy_guidelines: [
                "If you drink, limit to 1-2 drinks per day maximum",
                "Have alcohol-free days each week",
                "Avoid binge drinking episodes",
                "Drink with meals rather than on empty stomach"
            ],
            research: "NIAAA and ADA Guidelines"
        }
    ],
    heavy_drinking: [
        {
            title: "Your alcohol intake is significantly elevated",
            message: "Heavy drinking substantially increases diabetes and liver disease risk.",
            timeline_impact: {
                "1_month": "Liver stress, blood sugar fluctuations",
                "3_months": "Early fatty liver changes",
                "6_months": "Chronic metabolic changes",
                "1_year": "43% increased T2D risk"
            },
            reduction_goals: [
                "Reduce by 2 drinks per week each week",
                "Set maximum 2 drinks per occasion",
                "Designate 3+ alcohol-free days per week",
                "Consider professional support if difficult to reduce"
            ],
            research: "Baliunas et al., 2009"
        }
    ],
    binge_pattern: [
        {
            title: "Binge drinking episodes detected",
            message: "Binge drinking causes acute blood sugar dysregulation.",
            timeline_impact: "Each binge episode significantly spikes blood glucose and insulin",
            improvement_tips: [
                "Set a firm limit before drinking (e.g., 2 drinks maximum)",
                "Alternate alcoholic drinks with water",
                "Eat a meal before drinking",
                "Plan transportation to avoid extended drinking"
            ],
            research: "NIAAA Binge Drinking Guidelines"
        }
    ],
    light_moderate: [
        {
            title: "Your alcohol intake is within guidelines",
            message: "Light to moderate consumption shows neutral to slightly protective effects.",
            protective_note: "Light drinking (≤3/week) may have slight protective effect against T2D",
            maintenance_tips: [
                "Continue limiting to current levels",
                "Avoid progression to heavier drinking",
                "Monitor if life stress increases consumption"
            ],
            research: "Baliunas et al., 2009"
        }
    ]
};
```

---

## 5. Smoking Intake Recommendations

### 5.1 Research Basis

**Meta-Analysis by Willi et al. (2007)**:
- Active smoking increases T2D risk by 44%
- Dose-response relationship with pack-years
- Risk decreases after quitting (10+ years approaches baseline)

**Pan et al. (2015)**:
- Dose-response relationship: higher pack-years = higher risk
- ≥30 pack-years: >60% increased T2D risk

**Akter et al. (2017)**:
- Quitting reduces risk over time
- 5-10 years after quitting: significant risk reduction
- 10+ years: approaches non-smoker risk

### 5.2 Risk Factors & Timeline Predictions

#### Current Smoker Patterns

| Pack-Years | Current Risk Increase | Research Reference |
|------------|----------------------|-------------------|
| <10 | 44% (baseline smoker risk) | Willi et al., 2007 |
| 10-19 | 50% increased risk | Pan et al., 2015 |
| 20-29 | 55% increased risk | Pan et al., 2015 |
| ≥30 | 60%+ increased risk | Pan et al., 2015 |

#### Quitting Timeline Benefits

| Time Since Quitting | Risk Reduction | Research Reference |
|--------------------|---------------|-------------------|
| <1 year | Minimal reduction | Akter et al., 2017 |
| 1-5 years | 10-15% reduction | Akter et al., 2017 |
| 5-10 years | 30-40% reduction | Akter et al., 2017 |
| >10 years | Approaches non-smoker | Akter et al., 2017 |

**Prediction Algorithm**:
```python
def predict_smoking_impact(smoking_status, pack_years, years_since_quit=None):
    """
    Predicts health impact of smoking history.
    
    Based on:
    - Willi et al., 2007: JAMA meta-analysis
    - Pan et al., 2015: Lancet dose-response study
    - Akter et al., 2017: Quitting benefits study
    """
    predictions = {
        "current_status": smoking_status,
        "pack_years": pack_years,
        "risk_category": "",
        "current_risk_multiplier": 1.0,
        "timeline_predictions": {}
    }
    
    if smoking_status == "never":
        predictions["risk_category"] = "low"
        predictions["current_risk_multiplier"] = 1.0
        predictions["message"] = "Never smokers have baseline diabetes risk"
        return predictions
    
    elif smoking_status == "current":
        # Dose-response based on pack-years
        if pack_years >= 30:
            predictions["risk_category"] = "very_high"
            predictions["current_risk_multiplier"] = 1.60
        elif pack_years >= 20:
            predictions["risk_category"] = "high"
            predictions["current_risk_multiplier"] = 1.55
        elif pack_years >= 10:
            predictions["risk_category"] = "moderate_high"
            predictions["current_risk_multiplier"] = 1.50
        else:
            predictions["risk_category"] = "moderate"
            predictions["current_risk_multiplier"] = 1.44
        
        # Continued smoking predictions
        cigarettes_per_day = (pack_years / max(1, pack_years)) * 20  # Estimate
        predictions["timeline_predictions"] = {
            "1_year_continued": {
                "additional_pack_years": cigarettes_per_day * 365 / 20 / 20,
                "impact": "Cumulative damage continues",
                "research": "Pan et al., 2015"
            },
            "quitting_now_benefits": {
                "1_year": "Risk starts to decline",
                "5_years": "30-40% risk reduction from current",
                "10_years": "Approaches non-smoker risk",
                "research": "Akter et al., 2017"
            }
        }
    
    elif smoking_status == "former":
        # Risk reduction based on years since quit
        if years_since_quit >= 10:
            predictions["risk_category"] = "low_moderate"
            predictions["current_risk_multiplier"] = 1.10
            predictions["message"] = "Risk approaching non-smoker levels"
        elif years_since_quit >= 5:
            # Adjust by pack-years
            if pack_years >= 20:
                predictions["risk_category"] = "moderate"
                predictions["current_risk_multiplier"] = 1.25
            else:
                predictions["risk_category"] = "low_moderate"
                predictions["current_risk_multiplier"] = 1.15
        else:  # <5 years
            if pack_years >= 20:
                predictions["risk_category"] = "high"
                predictions["current_risk_multiplier"] = 1.40
            else:
                predictions["risk_category"] = "moderate_high"
                predictions["current_risk_multiplier"] = 1.30
        
        predictions["timeline_predictions"] = {
            "continued_abstinence": {
                "5_years": "Risk continues to decline",
                "10_years": "Approaches non-smoker risk",
                "research": "Akter et al., 2017"
            }
        }
    
    return predictions
```

### 5.3 Smoking Recommendations

```javascript
const smokingRecommendations = {
    never_smoker: [
        {
            title: "Excellent! You've never smoked",
            message: "Never smoking is one of the best things for your health.",
            protective_effect: "Avoiding smoking prevents 44%+ T2D risk increase",
            maintenance_tips: [
                "Continue avoiding tobacco products",
                "Minimize secondhand smoke exposure"
            ],
            research: "Willi et al., 2007"
        }
    ],
    current_smoker: [
        {
            title: "Smoking significantly increases your diabetes risk",
            message: "Current smoking increases T2D risk by 44-60% depending on pack-years.",
            timeline_impact: {
                "continued_1_year": "Risk continues to accumulate with more pack-years",
                "quit_1_year": "Risk begins to decline",
                "quit_5_years": "30-40% risk reduction",
                "quit_10_years": "Near non-smoker risk levels"
            },
            quitting_resources: [
                "Speak with your doctor about cessation aids",
                "Consider nicotine replacement therapy",
                "Use smoking cessation apps and support groups",
                "Set a quit date and tell friends/family"
            ],
            immediate_benefits: [
                "Within 20 min: Heart rate drops",
                "Within 12 hours: Carbon monoxide normalizes",
                "Within 2-12 weeks: Circulation improves",
                "Within 1-9 months: Coughing decreases"
            ],
            research: "Willi et al., 2007; Pan et al., 2015"
        }
    ],
    former_smoker_recent: [
        {
            title: "Great job quitting! Keep going",
            message: "Your risk is declining but hasn't yet reached non-smoker levels.",
            timeline_projection: {
                "current": "Risk still elevated due to recent quit",
                "5_years": "Risk will be significantly reduced",
                "10_years": "Risk will approach non-smoker levels"
            },
            maintenance_tips: [
                "Stay vigilant against relapse triggers",
                "Continue using cessation support if needed",
                "Celebrate milestones (1 month, 6 months, 1 year)",
                "Remember: each smoke-free day reduces risk"
            ],
            research: "Akter et al., 2017"
        }
    ],
    former_smoker_long: [
        {
            title: "Your risk has significantly reduced",
            message: "After 10+ years smoke-free, your risk approaches non-smoker levels.",
            protective_achievement: "You've achieved major risk reduction through sustained abstinence",
            maintenance_tips: [
                "Continue smoke-free lifestyle",
                "Focus on other lifestyle factors for continued health"
            ],
            research: "Akter et al., 2017"
        }
    ]
};
```

---

## Implementation Architecture

### Backend Service Structure

```
backend/
├── services/
│   ├── lifestyle_recommendation_service.py  # NEW: Unified recommendation engine
│   ├── food_tracking_service.py            # Add get_timeline_predictions()
│   ├── sleep_tracking_service.py           # Add get_timeline_predictions()
│   ├── step_tracking_service.py            # Add get_timeline_predictions()
│   └── ...
├── controllers/
│   ├── lifestyle_recommendation_controller.py  # NEW: API endpoints
│   └── ...
└── routes/
    └── lifestyle_routes.py                     # NEW: Route definitions
```

### New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/lifestyle/recommendations` | GET | Get unified recommendations for all trackers |
| `/api/v1/lifestyle/predictions` | GET | Get timeline predictions based on current patterns |
| `/api/v1/lifestyle/summary` | GET | Get overall lifestyle risk summary |
| `/api/v1/food/predictions` | GET | Get food-specific timeline predictions |
| `/api/v1/sleep/predictions` | GET | Get sleep-specific timeline predictions |
| `/api/v1/activity/predictions` | GET | Get activity-specific timeline predictions |
| `/api/v1/alcohol/predictions` | GET | Get alcohol-specific timeline predictions |
| `/api/v1/smoking/predictions` | GET | Get smoking-specific timeline predictions |

### Mobile Component Structure

```
mobile/
├── components/
│   ├── recommendations/
│   │   ├── index.js                       # Export all components
│   │   ├── TimelinePredictionCard.js      # Shows timeline predictions
│   │   ├── RecommendationCard.js          # Shows personalized recommendations
│   │   ├── HealthyDefaultsCard.js         # Shows healthy defaults
│   │   └── LifestyleRecommendationsSection.js  # Main container component
│   └── ...
└── screens/
    ├── FoodTrackerScreen.js               # Integrated with LifestyleRecommendationsSection
    ├── SleepTrackingScreen.js             # Integrated with LifestyleRecommendationsSection
    ├── StepCounterScreen.js               # Integrated with LifestyleRecommendationsSection
    ├── AlcoholTrackingScreen.js           # Integrated with LifestyleRecommendationsSection
    └── SmokingIntakeScreen.js             # Integrated with LifestyleRecommendationsSection
```

### Mobile Component Usage

```jsx
// Import the unified component
import { LifestyleRecommendationsSection } from '../components/recommendations';

// Use in any tracker screen
<LifestyleRecommendationsSection 
  trackerType="food"  // Options: 'food', 'sleep', 'activity', 'alcohol', 'smoking'
  onError={(err) => console.error(err)}
/>
```

### Component Features

| Component | Features |
|-----------|----------|
| `TimelinePredictionCard` | Expandable timeline, risk color coding, research citations |
| `RecommendationCard` | Priority badges, category icons, checkable items |
| `HealthyDefaultsCard` | Grid layout, tracker-specific icons, research notes |
| `LifestyleRecommendationsSection` | Auto-fetch, loading states, error handling, refresh |

---

## API Reference

### Unified Recommendations Endpoint

**Request:**
```http
GET /api/v1/lifestyle/recommendations
Authorization: Bearer <token>
```

**Response:**
```json
{
    "success": true,
    "data": {
        "overall_risk_score": 42,
        "overall_risk_category": "moderate",
        "trackers": {
            "food": {
                "has_data": true,
                "risk_score": 45,
                "top_recommendations": [...],
                "timeline_predictions": {...}
            },
            "sleep": {
                "has_data": true,
                "risk_score": 35,
                "top_recommendations": [...],
                "timeline_predictions": {...}
            },
            "steps": {
                "has_data": false,
                "healthy_defaults": [...]
            },
            "alcohol": {
                "has_data": true,
                "risk_score": 20,
                "top_recommendations": [...],
                "timeline_predictions": {...}
            },
            "smoking": {
                "has_data": true,
                "risk_score": 0,
                "status": "never_smoker"
            }
        },
        "priority_actions": [
            {
                "tracker": "food",
                "action": "Reduce glycemic load",
                "impact": "Could prevent 15% T2D risk increase in 1 year"
            },
            {
                "tracker": "sleep",
                "action": "Increase sleep duration by 1 hour",
                "impact": "Could improve insulin sensitivity by 15%"
            }
        ],
        "healthy_defaults": {
            "message": "When you don't have enough data, follow these general guidelines",
            "guidelines": [
                "Aim for 7-8 hours of sleep nightly",
                "Walk 7,000-10,000 steps daily",
                "Eat 5+ servings of vegetables",
                "Limit alcohol to ≤2 drinks/day (men) or ≤1 (women)",
                "Don't smoke"
            ]
        }
    }
}
```

---

## UI/UX Enhancements (February 2026)

### Timeline Prediction Enhancements

#### Chronological Sorting
All timeline predictions are now automatically sorted from shortest to longest duration for better user comprehension:

**Sort Order:**
1. 1 Week
2. 1 Month
3. 3 Months
4. 6 Months
5. 1 Year
6. Continued/Long-term predictions

**Implementation:** [TimelinePredictionCard.js](mobile/components/recommendations/TimelinePredictionCard.js)

```javascript
// Sort timeline predictions by duration (shortest to longest)
.sort(([keyA], [keyB]) => {
  const order = ['1_week', '1_month', '3_months', '6_months', '1_year', 'continued_1_year', 'if_quit_now', 'continued_abstinence'];
  const indexA = order.indexOf(keyA);
  const indexB = order.indexOf(keyB);
  // If both keys are in the order array, sort by their position
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  // If only one is in the order array, it comes first
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  // Otherwise, maintain original order
  return 0;
})
```

#### Explanatory Descriptions

Each timeline prediction now includes a `description` field explaining **why** the prediction works that way, based on research:

**Example (Sleep Tracking):**

```json
{
  "1_week": {
    "impact": "16% decrease in insulin sensitivity if sleep-deprived",
    "description": "Short sleep rapidly affects insulin sensitivity. Your body's ability to regulate blood sugar is already being impaired.",
    "research": "Spiegel et al., 1999"
  },
  "1_month": {
    "impact": "Elevated cortisol and appetite hormones",
    "description": "Chronic sleep deprivation disrupts leptin and ghrelin (hunger hormones), increasing cravings for high-calorie foods.",
    "research": "Taheri et al., 2004"
  },
  "6_months": {
    "impact": "Chronic metabolic changes",
    "description": "Sustained sleep patterns like yours (avg 5.5h) lead to cumulative metabolic dysfunction and weight gain.",
    "research": "Buxton et al., 2012"
  },
  "1_year": {
    "impact": "28% increased T2D risk",
    "description": "At 5.5h per night, epidemiological studies show a 28% increased risk of type 2 diabetes. This is due to prolonged insulin resistance and metabolic stress.",
    "research": "Cappuccio et al., 2010"
  }
}
```

**Display Component:** [TimelinePredictionCard.js](mobile/components/recommendations/TimelinePredictionCard.js#L67-L107)

```javascript
const renderTimelineItem = (key, data) => {
  const label = timelineLabels[key] || key.replace(/_/g, ' ');
  const impact = typeof data === 'string' ? data : data.impact || data.projected_risk_change;
  const description = typeof data === 'object' ? data.description : null;
  const research = typeof data === 'object' ? data.research : null;
  
  return (
    <View style={styles.timelineItem}>
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={styles.timelineImpact}>{impact}</Text>
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      {research && (
        <Text style={styles.research}>📚 {research}</Text>
      )}
    </View>
  );
};
```

### Recommendation Card Enhancements

#### Enhanced Recommendation Display

Recommendations now display comprehensive, structured information instead of simple text:

**Before:**
- ✗ Only showed generic text with priority tag
- ✗ No actionable guidance
- ✗ No context or explanation

**After:**
- ✓ **Title** - Clear recommendation heading
- ✓ **Message** - Personalized explanation with user's specific data
- ✓ **Priority Tags** - Critical/High/Medium/Low with color coding
- ✓ **💡 Action Steps** - Specific, actionable tips
- ✓ **📈 Progressive Goals** - Week-by-week improvement plans
- ✓ **✓ Maintenance Tips** - For users with healthy patterns
- ✓ **🛡️ Protective Effect** - Positive reinforcement messages

**Implementation:** [RecommendationCard.js](mobile/components/recommendations/RecommendationCard.js#L96-L224)

#### Recommendation Object Structure

```javascript
{
  "priority": "critical",           // critical | high | medium | low
  "category": "Sleep Duration",     // Category label
  "title": "Your sleep duration is critically low",
  "message": "Averaging 5.5 hours significantly increases diabetes risk",
  
  // For risky patterns
  "actionable_tips": [
    "Set a non-negotiable bedtime",
    "Create a sleep-promoting environment (cool, dark, quiet)",
    "Avoid screens 1 hour before bed",
    "Limit caffeine after 2 PM",
    "Consider speaking with a doctor about sleep issues"
  ],
  
  // For progressive improvement
  "progressive_goals": {
    "week_1": "Add 500 steps daily (5-minute walk)",
    "week_2": "Add 1,000 steps daily total",
    "week_4": "Aim for 5,000 steps daily",
    "month_2": "Work toward 7,000 steps daily"
  },
  
  // For healthy patterns
  "protective_effect": "Optimal sleep duration supports metabolic health",
  "maintenance_tips": [
    "Maintain consistency throughout the week",
    "Consider adding strength training 2x/week",
    "Vary activities to prevent overuse injuries"
  ],
  
  // Timeline impact (optional)
  "timeline_impact": {
    "1_week": "16% decrease in insulin sensitivity",
    "1_month": "Elevated cortisol and increased appetite",
    "6_months": "Chronic metabolic dysfunction",
    "1_year": "35%+ increased T2D risk"
  }
}
```

#### Display Features

**Priority Color Coding:**
```javascript
const priorityColors = {
  critical: '#C0392B',  // Dark red - urgent attention
  high: '#E74C3C',      // Red - important
  medium: '#F39C12',    // Orange - moderate
  low: '#27AE60'        // Green - maintenance/positive
};
```

**Visual Elements:**
- 🛡️ Shield icon for protective effects (green)
- 💡 Lightbulb for action steps
- 📈 Chart icon for progressive goals
- ✓ Checkmark for maintenance tips
- Color-coded priority badges
- Expandable/collapsible sections

### Component Architecture

#### LifestyleRecommendationsSection.js

**Purpose:** Unified, reusable component for displaying predictions across all lifestyle trackers

**Usage Across Trackers:**
```javascript
// Food Tracker
<LifestyleRecommendationsSection trackerType="food" />

// Sleep Tracker
<LifestyleRecommendationsSection trackerType="sleep" />

// Activity Tracker
<LifestyleRecommendationsSection trackerType="activity" />

// Alcohol Tracker
<LifestyleRecommendationsSection trackerType="alcohol" />

// Smoking Tracker
<LifestyleRecommendationsSection trackerType="smoking" />
```

**Screen Integration:**
- [FoodTrackerScreen.js](mobile/screens/FoodTrackerScreen.js#L495) - `trackerType="food"`
- [SleepTrackingScreen.js](mobile/screens/SleepTrackingScreen.js#L1406) - `trackerType="sleep"`
- [StepCounterScreen.js](mobile/screens/StepCounterScreen.js#L1660) - `trackerType="activity"`
- [AlcoholTrackingScreen.js](mobile/screens/AlcoholTrackingScreen.js#L428) - `trackerType="alcohol"`
- [SmokingIntakeScreen.js](mobile/screens/SmokingIntakeScreen.js#L709) - `trackerType="smoking"`

#### Data Flow Isolation

**No Cross-Contamination Between Trackers:**

```
Component Instance State (Isolated)
  ├─ useState: loading
  ├─ useState: data
  ├─ useState: error
  └─ useState: expandedStates

API Endpoints (Separate)
  ├─ GET /api/v1/lifestyle/food/predictions
  ├─ GET /api/v1/lifestyle/sleep/predictions
  ├─ GET /api/v1/lifestyle/activity/predictions
  ├─ GET /api/v1/lifestyle/alcohol/predictions
  └─ GET /api/v1/lifestyle/smoking/predictions

Data Sources (Independent)
  ├─ Food: meals collection
  ├─ Sleep: sleep_daily_records collection
  ├─ Activity: daily_activities collection
  ├─ Alcohol: alcohol_intake collection
  └─ Smoking: smoking_intake collection
```

**Configuration per Tracker:**
```javascript
const trackerConfig = {
  food: {
    title: 'Diet Predictions',
    icon: 'food-apple',
    color: '#27AE60',
    fetchFn: api.getFoodPredictions,
  },
  sleep: {
    title: 'Sleep Predictions',
    icon: 'sleep',
    color: '#9B59B6',
    fetchFn: api.getSleepPredictions,
  },
  activity: {
    title: 'Activity Predictions',
    icon: 'walk',
    color: '#3498DB',
    fetchFn: api.getActivityPredictions,
  },
  // ... etc
};
```

### Adaptive Risk Assessment

#### Confidence-Weighted Predictions

The system automatically adjusts recommendations based on data quantity:

**Data Confidence Levels:**
| Days Tracked | Data Weight | Baseline Weight | Behavior |
|--------------|-------------|-----------------|----------|
| <7 days | 30% | 70% | Heavy baseline weighting, preliminary assessment |
| 7-13 days | 50% | 50% | Balanced blend of actual and baseline data |
| 14-29 days | 75% | 25% | Primarily actual data, variability analysis enabled |
| 30+ days | 90% | 10% | High confidence in actual data patterns |

**User Feedback Messages:**
```javascript
{
  days_tracked: 4,
  warning: "⚠️ Assessment based on only 4 day(s). Track for at least 7 days for reliable risk assessment.",
  confidence_level: "preliminary"
}

{
  days_tracked: 18,
  info: "ℹ️ Assessment based on 18 days. Track for 14+ days for more accurate variability assessment.",
  confidence_level: "good"
}

{
  days_tracked: 35,
  success: "✓ Assessment based on sufficient data (35 days tracked).",
  confidence_level: "high"
}
```

#### Self-Correcting Over Time

**Example: Sleep Improvement Journey**

**Week 1 (3 days tracked, avg 5.5h):**
```json
{
  "risk_score": 15,  // Weighted: 30% actual data
  "actual_risk_score": 40,
  "message": "⚠️ Early Warning: Your recent sleep data shows higher risk patterns (actual risk: 40). Continue tracking to confirm trends.",
  "recommendations": [
    {
      "priority": "critical",
      "title": "Your sleep duration is critically low"
    }
  ]
}
```

**Week 3 (16 days tracked, avg 6.8h - improved!):**
```json
{
  "risk_score": 22,  // Weighted: 75% actual data
  "actual_risk_score": 28,
  "message": "Your sleep patterns are improving! Keep it up.",
  "recommendations": [
    {
      "priority": "medium",
      "title": "You're approaching optimal sleep duration"
    }
  ]
}
```

**Week 5 (32 days tracked, avg 7.2h - optimal!):**
```json
{
  "risk_score": 8,  // Weighted: 90% actual data
  "actual_risk_score": 5,
  "message": "✓ Assessment based on sufficient data (32 days tracked).",
  "recommendations": [
    {
      "priority": "low",
      "title": "Excellent sleep duration!",
      "protective_effect": "Optimal sleep supports metabolic health",
      "maintenance_tips": [...]
    }
  ]
}
```

### Benefits of Enhanced System

1. **Better User Understanding** - Descriptions explain the "why" behind predictions
2. **Actionable Guidance** - Specific steps users can take immediately
3. **Progressive Approach** - Week-by-week goals prevent overwhelm
4. **Positive Reinforcement** - Celebrates healthy behaviors
5. **Research Transparency** - All recommendations backed by citations
6. **Chronological Clarity** - Sorted timeline makes progression obvious
7. **Data-Driven Adaptation** - Automatically adjusts as users improve
8. **No False Alarms** - Confidence weighting prevents premature warnings

---

## Research References

1. Knowler WC, et al. (2002). Reduction in the incidence of type 2 diabetes with lifestyle intervention or metformin. NEJM. 346(6):393-403.

2. Lindström J, et al. (2006). Sustained reduction in the incidence of type 2 diabetes by lifestyle intervention. Lancet. 368(9548):1673-9.

3. Cappuccio FP, et al. (2010). Quantity and quality of sleep and incidence of type 2 diabetes. Diabetes Care. 33(2):414-420.

4. Kraus WE, et al. (2019). Association of daily step count and step intensity with mortality among US adults. JAMA. 323(12):1151-1160.

5. Baliunas DO, et al. (2009). Alcohol as a risk factor for type 2 diabetes. Diabetes Care. 32(11):2123-2132.

6. Willi C, et al. (2007). Active smoking and the risk of type 2 diabetes. JAMA. 298(22):2654-2664.

7. Pan A, et al. (2015). Relation of smoking with total mortality and cardiovascular events. Lancet. 386(10001):1324-32.

8. Akter S, et al. (2017). Smoking and the risk of type 2 diabetes. Epidemiology. 28(2):192-200.

9. Spiegel K, et al. (1999). Impact of sleep debt on metabolic and endocrine function. Lancet. 354(9188):1435-9.

10. Patterson R, et al. (2018). Sedentary behaviour and risk of all-cause, cardiovascular and cancer mortality. Br J Sports Med. 52(13):837-844.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | January 31, 2026 | Initial documentation with research-based recommendations |
| 1.1.0 | February 15, 2026 | **UI/UX Enhancements**: Added timeline prediction descriptions, enhanced recommendation display with actionable tips, progressive goals, and maintenance advice. Implemented chronological sorting for timeline predictions. Updated sleep tracker implementation. |

---

*This document is maintained by the GlycoFit development team. Last updated: February 15, 2026.*
