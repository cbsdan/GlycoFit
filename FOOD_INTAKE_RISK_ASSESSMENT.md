# Food Intake Risk Assessment for Prediabetes - Research-Based Implementation

## Overview

This document outlines the comprehensive food intake risk assessment system implemented in GlycoFit to evaluate users' risk of developing prediabetes based on their eating habits and daily food consumption patterns.

## System Architecture

### Components

1. **Baseline Assessment** - Initial evaluation of eating habits and lifestyle
2. **Daily Log Analysis** - Continuous monitoring of actual food intake
3. **Risk Calculation Engine** - Research-based algorithms for risk scoring
4. **Personalized Recommendations** - Actionable guidance based on individual patterns

### Workflow

```
User Registration → Baseline Assessment → Daily Food Logging → Risk Analysis → Recommendations → Continuous Monitoring
```

### User Experience Flow

#### Initial Setup (First-Time Users)
1. **Landing on Food Tracker** → User sees welcome screen prompting baseline assessment
2. **Baseline Assessment** → 16-question step-by-step questionnaire (2-3 minutes)
3. **Baseline Complete** → Shows initial risk score based on eating habits
4. **Dashboard Unlocked** → User can now see risk breakdown and start logging meals

#### Daily Usage (Returning Users)
1. **Open Food Tracker** → Shows comprehensive risk dashboard
2. **Risk Score Display** → Large visual card with percentage and category
3. **Risk Breakdown** → Two components clearly explained:
   - **Baseline Risk (40% weight)**: Based on eating habits, meal timing, food preferences
   - **Daily Log Risk (60% weight)**: Based on actual nutrient intake from logged meals
4. **Intelligent Display**:
   - **If no meals logged**: Shows "No Meals Logged Yet" card with prompt to log first meal
   - **If meals logged**: Shows daily nutrient averages with # of meals over # of days
5. **Personalized Recommendations** → Priority-based action items with icons
6. **Action Buttons** → "Log New Meal" (primary) and "Update Baseline" (secondary)

### Why Daily Logs are Weighted Higher (60% vs 40%)

The comprehensive risk calculation gives more weight to daily food logs for several research-backed reasons:

1. **Real-Time Accuracy**: Daily logs reflect current eating patterns, not just reported habits or intentions
2. **Actual Nutrient Intake**: Measures precise amounts of nutrients consumed (calories, sugars, fiber, glycemic load, etc.)
3. **Pattern Detection**: Identifies actual meal timing issues (late-night eating, breakfast skipping, irregular patterns)
4. **Behavioral Evidence**: Shows what users actually eat vs. what they think or report they eat
5. **Dynamic Monitoring**: Captures changes in diet that baseline questions might miss
6. **Research Support**: Studies show actual intake is more predictive of diabetes risk than self-reported habits

**Example Scenario:**
- User's baseline assessment suggests moderate healthy eating habits (30% risk)
- But daily logs show high added sugar (50g/day) and low fiber (10g/day) → 70% risk from logs
- Comprehensive score: (30% × 0.4) + (70% × 0.6) = 54% (High Risk)
- This accurately reflects that despite good intentions, actual eating patterns increase risk

**Important Note on No Meal Data:**
- When no meals are logged, daily log risk = baseline risk (NOT zero)
- This prevents "gaming" where users could lower their score by not logging unhealthy meals
- Users must log meals to get accurate personalized risk assessment based on actual intake

### Handling Users Without Meal Logs

#### Display Logic:
- **Baseline Only**: Shows baseline risk score with explanation that daily logs will improve accuracy
- **No Daily Averages Section**: Instead shows "No Meals Logged Yet" card with:
  - Icon indicating no data
  - Message: "Start logging your meals to see daily nutrient averages and get personalized recommendations based on your actual food intake"
  - Call-to-action button: "Log Your First Meal"
  
#### Risk Calculation (IMPORTANT):
- **When no meals logged**: Daily log risk defaults to baseline risk score (NOT zero)
- This prevents users from "gaming the system" by not logging unhealthy meals
- Comprehensive risk = (Baseline × 0.4) + (Baseline × 0.6) = Baseline
- User sees same score for both components, with explanation: "Start logging meals to get personalized analysis"
- **Why this approach**: If daily log risk = 0 when no meals, users could artificially lower their risk by not logging. By defaulting to baseline risk, we maintain neutrality until real data is available.

#### Partial Logging Protection (CRITICAL):
- **Problem**: Users logging only SOME meals (e.g., breakfast only) creates under-reporting
- **Example**: User logs 1 breakfast/day (400 cal) but skips logging lunch & dinner
  - System calculates: 400 cal / 1 day = 400 cal/day average
  - Reality: User actually ate 1700 cal/day (breakfast + lunch + dinner)
  - **Result**: Assessment shows user as much healthier than reality!

- **Solution Implemented**:
  - **Data Sufficiency Check**: Minimum 2 meals/day required for reliable assessment
  - **Data Quality Levels**:
    - `good`: ≥2.5 meals/day average
    - `partial`: 1.5-2.4 meals/day average (warning shown)
    - `insufficient`: <1.5 meals/day average (critical warning shown)
  
  - **Warning System**:
    ```
    If insufficient data:
    - Priority: CRITICAL
    - Message: "Only X meals logged (avg Y/day). Your risk assessment is 
               likely INACCURATE. Log at least 2-3 meals daily for reliable results."
    
    If partial data:
    - Priority: HIGH  
    - Message: "Logging X meals/day. For more accurate assessment, try to log 
               all meals (aim for 3+ daily)."
    ```

- **Important**: System still calculates risk with partial data, but warns user that results may not reflect reality

#### Recommendations:
- Basic recommendations generated from baseline assessment alone
- Focus on general healthy eating principles
- Once meals are logged, recommendations become specific to nutrient deficiencies/excesses

## Research Foundation

### Key Research Findings on Prediabetes Risk Factors

The assessment is based on peer-reviewed research identifying dietary and behavioral factors associated with increased prediabetes and type 2 diabetes risk:

#### 1. **Dietary Composition Factors**

**Added Sugars (Weight: 0.15 - High Impact)**
- Research shows that high added sugar intake is strongly associated with increased diabetes risk
- WHO recommends limiting added sugars to <10% of total energy intake (~25g/day)
- Excessive sugar consumption leads to insulin resistance and metabolic dysfunction
- *Source: Pan et al., 2010; Malik et al., 2010*

**Glycemic Load (Weight: 0.13 - High Impact)**
- High glycemic load diets increase blood glucose spikes and insulin demand
- Chronic high GL intake associated with β-cell dysfunction
- Optimal daily GL: <100; High risk: >150
- *Source: Schulze et al., 2004; Bhupathiraju et al., 2014*

**Refined Carbohydrates (Weight: 0.11 - High Impact)**
- White bread, white rice, and refined grains linked to increased diabetes risk
- Lack of fiber and rapid digestion contribute to glucose dysregulation
- *Source: Sun et al., 2010; de Munter et al., 2007*

**Fiber (Weight: -0.10 - Strong Protective)**
- High fiber intake (≥25g/day) reduces diabetes risk by 15-30%
- Soluble fiber improves insulin sensitivity and glucose metabolism
- Protective effect through improved gut health and slower glucose absorption
- *Source: Yao et al., 2014; InterAct Consortium, 2015*

**Saturated Fat (Weight: 0.09)**
- High saturated fat intake associated with insulin resistance
- Recommended: <7% of total energy intake (~20g/day)
- *Source: Risérus et al., 2009*

**Protein (Weight: 0.03 - Moderate Impact)**
- Optimal intake: 50-175g/day (15-25% of calories)
- Very high or very low protein intake may impact metabolic health
- Quality of protein sources matters (plant vs. animal)
- *Source: Solon-Biet et al., 2019*

#### 2. **Behavioral Patterns**

**Skipping Breakfast (Weight: 0.08)**
- Regular breakfast skipping linked to 21% increased diabetes risk
- Disrupts circadian rhythm and glucose metabolism
- Associated with compensatory overeating later in day
- *Source: Ballon et al., 2019; Bi et al., 2015*

**Late Night Eating (Weight: 0.07)**
- Eating within 2 hours of bedtime disrupts metabolic processes
- Reduces insulin sensitivity and glucose tolerance
- Affects circadian regulation of metabolism
- *Source: Yoshida et al., 2018; Kant & Graubard, 2015*

**Meal Frequency (Weight: 0.05)**
- Irregular meal patterns associated with metabolic dysfunction
- Optimal: 3-4 balanced meals per day
- Very frequent snacking or meal skipping increases risk
- *Source: Paoli et al., 2019*

**Eating Speed (Weight: 0.06)**
- Fast eating associated with insulin resistance
- Rapid consumption reduces satiety signals
- Leads to overconsumption and weight gain
- *Source: Ohkuma et al., 2015; Nagahama et al., 2014*

#### 3. **Food Group Consumption**

**Processed Foods (Weight: 0.10)**
- Ultra-processed foods linked to 15% increased diabetes risk per daily serving
- High in refined carbs, unhealthy fats, and additives
- Low in protective nutrients and fiber
- *Source: Srour et al., 2020; Fiolet et al., 2018*

**Sugary Beverages (Weight: 0.12)**
- Each daily serving increases diabetes risk by 13-26%
- Rapid glucose absorption without satiety
- Major contributor to metabolic syndrome
- *Source: Imamura et al., 2015; Malik et al., 2010*

**Whole Grains (Weight: -0.08 - Protective)**
- Regular whole grain consumption reduces risk by 20-30%
- Rich in fiber, vitamins, minerals, and phytochemicals
- Improves insulin sensitivity
- *Source: Aune et al., 2013; Parker et al., 2013*

**Vegetables (Weight: -0.06 - Protective)**
- 5+ servings/day associated with reduced diabetes risk
- Rich in fiber, antioxidants, and micronutrients
- Low calorie density supports healthy weight
- *Source: Carter et al., 2010; Cooper et al., 2012*

**Fruits (Weight: -0.05 - Moderate Protective)**
- Moderate fruit intake (2-3 servings) beneficial
- Whole fruits preferred over juice due to fiber content
- Natural sugars less impactful than added sugars
- *Source: Muraki et al., 2013*

**Red Meat (Weight: 0.07)**
- High consumption associated with increased diabetes risk
- Processed meats show stronger association than unprocessed
- Heme iron and saturated fat may contribute to risk
- *Source: Pan et al., 2011; Feskens et al., 2013*

**Fried Foods (Weight: 0.09)**
- Frequent fried food consumption increases risk
- High in trans fats and advanced glycation end products (AGEs)
- Associated with inflammation and insulin resistance
- *Source: Cahill et al., 2014*

## Risk Calculation Methodology

### 1. Baseline Risk Score (0-100%)

The baseline assessment evaluates 16 research-based questions covering:
- Meal frequency and timing patterns
- Food type consumption frequency
- Portion sizes and eating behaviors

**Calculation:**
```
For each question:
  - Convert response to numeric score (0-4 scale)
  - Apply question-specific risk weight
  - For protective factors (negative weight), reverse scoring
  
Total Risk = (Sum of weighted scores / Maximum possible score) × 100
```

### 2. Daily Log Risk Score (0-100%)

Analyzes actual food consumption over 7 days (configurable):

**A. Nutrient-Based Risk (70% weight)**

For each nutrient, compare daily average to optimal thresholds:

```
Nutrients with optimal range (e.g., calories):
  - Below minimum → risk proportional to shortfall
  - Above maximum → risk proportional to excess
  - Within range → no risk

Nutrients with optimal maximum (e.g., added sugars):
  - Below optimal → no risk
  - Between optimal and high risk → graduated risk
  - Above high risk → maximum risk

Nutrients with optimal minimum (e.g., fiber):
  - Above optimal → maximum protection
  - Below optimal → reduced protection (increased risk)
```

**Daily Nutrient Thresholds:**

| Nutrient | Optimal Min | Optimal Max | High Risk | Risk Weight |
|----------|------------|-------------|-----------|-------------|
| Calories | 1800 | 2200 | - | 0.08 |
| Carbs (g) | - | 250 | 350 | 0.12 |
| Added Sugars (g) | - | 25 | 50 | 0.15 |
| Fiber (g) | 25 | - | - | -0.10 |
| Saturated Fat (g) | - | 20 | 30 | 0.09 |
| Sodium (mg) | - | 2300 | 3400 | 0.06 |
| Glycemic Load | - | 100 | 150 | 0.13 |
| Protein (g) | 50 | 175 | - | 0.03 |

**B. Pattern-Based Risk (30% weight)**

Analyzes meal timing and frequency patterns:

1. **Meal Frequency**: Deviation from 3-4 meals/day
2. **Late Night Eating**: Percentage of meals after 8 PM
3. **Irregular Timing**: Daily variance in meal schedules

### 3. Comprehensive Risk Score

Combines baseline and daily log risks:

```
Comprehensive Risk = (Baseline Risk × 0.40) + (Daily Log Risk × 0.60)
```

**Rationale:**
- Daily logs weighted higher (60%) as they reflect current behavior
- Baseline provides context for habits and patterns (40%)
- Together provide holistic view of diabetes risk

### 4. Risk Categories

| Score Range | Category | Interpretation |
|-------------|----------|----------------|
| 0-24 | Low Risk | Eating habits show minimal risk factors |
| 25-49 | Moderate Risk | Some concerning patterns; improvement recommended |
| 50-74 | High Risk | Multiple risk factors present; changes needed |
| 75-100 | Very High Risk | Significant risk; immediate intervention advised |

## Personalized Recommendations

The system generates specific, actionable recommendations based on:

### Trigger Conditions:

1. **Added Sugars Exceeding 25g/day** → High priority recommendation
2. **Fiber Below 25g/day** → High priority recommendation
3. **Glycemic Load Above 100** → High priority recommendation
4. **Saturated Fat Exceeding 20g/day** → Medium priority
5. **Frequent Breakfast Skipping** → High priority
6. **Regular Sugary Drink Consumption** → High priority

### Recommendation Structure:

Each recommendation includes:
- **Category**: Specific nutrient or behavior
- **Priority**: High, Medium, or Low
- **Message**: Clear, actionable guidance with specific targets

## Clinical Validation Considerations

### Limitations:

1. Self-reported data subject to recall bias
2. Food logging accuracy depends on user diligence
3. Risk scores are predictive, not diagnostic
4. Individual metabolic variations not captured
5. Genetic and family history factors not included

### Appropriate Use:

- **Screening tool** for identifying at-risk individuals
- **Educational resource** for healthy eating
- **Behavior modification support**
- **Complement to clinical assessment**, not replacement

### Recommendations for Users:

⚠️ **Important Notice:**
- This assessment evaluates lifestyle risk factors only
- High risk scores should prompt consultation with healthcare provider
- Does not replace blood glucose testing or medical diagnosis
- Intended for prevention and early intervention support

## Implementation Details

### Critical Implementation Notes

#### No Meal Data Handling (Anti-Gaming Protection)
**Problem Prevented**: Users could artificially lower their risk scores by simply not logging unhealthy meals.

**Solution Implemented**:
```python
# In food_tracking_service.py - calculate_daily_log_risk()
if not result['success'] or not result['meals']:
    return {
        'daily_risk_score': None,  # NOT 0
        'has_data': False
    }

# In calculate_comprehensive_risk()
if not has_meal_data or daily_log_result.get('daily_risk_score') is None:
    daily_log_risk = baseline_risk  # Default to baseline, NOT 0

# Final calculation remains same
comprehensive_risk = (baseline_risk * 0.4) + (daily_log_risk * 0.6)
```

**Result**:
- No meals logged → daily_log_risk = baseline_risk
- Comprehensive = (baseline × 0.4) + (baseline × 0.6) = baseline
- User cannot lower score by avoiding logging
- Encourages consistent meal tracking for accurate assessment

#### Pattern Risk Calculation
```python
# When no meals exist
def _calculate_pattern_risk(meals, days):
    if not meals:
        return 0  # Neutral, not penalty
```

**Why 0 and not 50?**
- 50 would be an arbitrary penalty for not logging
- 0 is neutral - no data means no pattern analysis
- Comprehensive calculation handles this by using baseline risk

### Backend Components:

1. **`food_baseline_assessment.py`**
   - Stores baseline questionnaire responses
   - Calculates baseline risk scores using research-based weights
   - Manages question definitions and weights
   - **16 questions** covering eating habits, meal timing, food preferences

2. **`food_tracking_service.py`**
   - Analyzes daily food logs over configurable time period (default 7 days)
   - Calculates nutrient-based risk (70% weight) - analyzes 8 key nutrients
   - Calculates pattern-based risk (30% weight) - meal timing, frequency, irregularity
   - Generates comprehensive risk scores (40% baseline + 60% daily logs)
   - **Anti-gaming protection**: Defaults to baseline risk when no meals logged
   - Creates personalized recommendations based on specific nutrient deficiencies

3. **`food_risk_assessment_controller.py`**
   - API endpoints for baseline submission
   - Risk assessment retrieval with configurable analysis period
   - Recommendation generation
   - Daily log analysis endpoint

4. **`user_meal.py` (Enhanced)**
   - Supports all required nutrients (including glycemic load)
   - Allows custom meal datetime for accurate pattern analysis
   - Tracks ingredient-level nutrition data
   - Supports portion adjustments and ingredient proportions

### Mobile Components:

1. **FoodBaselineScreen**
   - Interactive questionnaire interface
   - Step-by-step progression (16 questions)
   - Real-time validation
   - Editable responses
   - Shows risk score upon completion
   - Navigates back to FoodIntakeScreen after submission

2. **FoodTrackerScreen (Unified Entry Point)**
   - Single entry point for all food tracking features
   - Intelligent routing based on user state:
     - **No baseline**: Shows welcome prompt with "Start Baseline Assessment" button
     - **Has baseline**: Shows comprehensive risk dashboard with "Scan & Log Food" button
   - Consolidated UI replacing separate FoodScanner and FoodIntakeRisk buttons

3. **FoodIntakeScreen (Risk Dashboard)**
   - **Risk Score Card**: Large gradient card showing percentage and category
   - **Risk Breakdown Section**: 
     - Baseline Assessment (40%) with explanation
     - Daily Log Analysis (60%) with meal count/days
     - Info box explaining why daily logs carry more weight
   - **Conditional Display**:
     - **With meals**: Daily nutrient averages grid (calories, carbs, protein, etc.)
     - **Without meals**: "No Meals Logged Yet" card with call-to-action
   - **Personalized Recommendations**: Priority-based cards with icons and colored badges
   - **Action Buttons**: 
     - Primary: "Log New Meal" (prominent)
     - Secondary: "Update Baseline Assessment"

4. **FoodScannerScreen (Enhanced)**
   - DateTime picker for meal timing (supports pattern analysis)
   - Comprehensive nutrient logging (all 10+ nutrients)
   - Ingredient-level tracking
   - Portion adjustment controls
   - Direct integration with risk assessment backend

### UI/UX Improvements

#### Visual Hierarchy
- **Risk Score**: Largest element with gradient background matching risk level
- **Breakdown**: Clear separation of baseline vs daily logs with progress bars
- **Nutrients**: Grid layout with consistent styling and units
- **Recommendations**: Color-coded priority (High=Red, Medium=Orange, Low=Blue)

#### Informative Design
- **Explanatory Text**: Each breakdown component explains what it measures
- **Weight Indicators**: Shows "40%" and "60%" to clarify calculation
- **Contextual Messages**: Dynamic text based on data availability
- **Empty States**: Helpful messages and actions when data is missing

#### Responsive Behavior
- **Pull to Refresh**: Updates all risk calculations and recommendations
- **Loading States**: Skeleton screens and spinners for better UX
- **Error Handling**: Graceful degradation when APIs fail
- **No Data States**: Constructive prompts instead of blank screens

## Data Privacy and Security

- All data encrypted in transit (HTTPS)
- Firebase authentication for user identity
- MongoDB storage with access controls
- No sharing of individual data
- User controls for data deletion

## Future Enhancements

### Planned Improvements:

1. **Machine Learning Integration**
   - Pattern recognition for meal timing
   - Predictive alerts for risk trends
   - Personalized threshold adjustments

2. **Extended Analysis**
   - Micronutrient tracking (vitamins, minerals)
   - Meal combination analysis
   - Circadian timing optimization

3. **Social Features**
   - Community support groups
   - Shared meal plans
   - Challenge systems

4. **Clinical Integration**
   - Export reports for healthcare providers
   - Integration with lab results
   - Medication tracking correlation

5. **Advanced Recommendations**
   - Meal planning suggestions
   - Recipe recommendations
   - Grocery shopping lists

## References

### Key Research Citations:

1. Aune, D., et al. (2013). "Whole grain consumption and risk of cardiovascular disease, cancer, and all cause and cause specific mortality." BMJ, 353.

2. Ballon, A., et al. (2019). "Breakfast Skipping Is Associated with Increased Risk of Type 2 Diabetes." Journal of Nutrition, 149(1).

3. Bhupathiraju, S. N., et al. (2014). "Glycemic index, glycemic load, and risk of type 2 diabetes." American Journal of Clinical Nutrition, 100(1).

4. Cahill, L. E., et al. (2014). "Fried-food consumption and risk of type 2 diabetes and coronary artery disease." American Journal of Clinical Nutrition, 100(2).

5. Carter, P., et al. (2010). "Fruit and vegetable intake and incidence of type 2 diabetes mellitus." BMJ, 341.

6. Feskens, E. J., et al. (2013). "Meat consumption, diabetes, and its complications." Current Diabetes Reports, 13(2).

7. Imamura, F., et al. (2015). "Consumption of sugar sweetened beverages and type 2 diabetes incidence." BMJ, 351.

8. InterAct Consortium. (2015). "Dietary fibre and incidence of type 2 diabetes in eight European countries." Diabetologia, 58(7).

9. Malik, V. S., et al. (2010). "Sugar-sweetened beverages and risk of metabolic syndrome and type 2 diabetes." Diabetes Care, 33(11).

10. Muraki, I., et al. (2013). "Fruit consumption and risk of type 2 diabetes." BMJ, 347.

11. Nagahama, S., et al. (2014). "Self-reported eating rate and metabolic syndrome in Japanese people." Internal Medicine, 53(7).

12. Ohkuma, T., et al. (2015). "Association between eating rate and obesity." International Journal of Epidemiology, 44(3).

13. Pan, A., et al. (2011). "Red meat consumption and risk of type 2 diabetes." American Journal of Clinical Nutrition, 94(4).

14. Risérus, U., et al. (2009). "Dietary fats and prevention of type 2 diabetes." Progress in Lipid Research, 48(1).

15. Schulze, M. B., et al. (2004). "Glycemic index, glycemic load, and dietary fiber intake and incidence of type 2 diabetes in younger and middle-aged women." American Journal of Clinical Nutrition, 80(2).

16. Srour, B., et al. (2020). "Ultra-processed food intake and risk of cardiovascular disease." BMJ, 365.

17. Sun, Q., et al. (2010). "White rice, brown rice, and risk of type 2 diabetes in US men and women." Archives of Internal Medicine, 170(11).

18. Yao, B., et al. (2014). "Dietary fiber intake and risk of type 2 diabetes." Diabetes Care, 37(2).

19. Yoshida, J., et al. (2018). "Association of night eating habits with metabolic syndrome and its components." Eating Behaviors, 29.

## Conclusion

The GlycoFit Food Intake Risk Assessment system provides a comprehensive, research-based approach to evaluating prediabetes risk through dietary and behavioral analysis. By combining baseline lifestyle assessment with continuous daily log monitoring, the system offers personalized insights and actionable recommendations to support diabetes prevention efforts.

The multi-faceted approach accounts for both immediate dietary composition (nutrients) and long-term behavioral patterns (meal timing, food choices), providing users with a holistic view of their metabolic health risks. As research continues to evolve, the system can be updated with new evidence and refined algorithms to improve accuracy and effectiveness.

---

**Document Version:** 1.0  
**Last Updated:** January 11, 2026  
**Maintained By:** GlycoFit Development Team
