# Alcohol Tracking Frontend Implementation Guide

## Overview
This document outlines how to implement the frontend screens for the new alcohol tracking system that follows the sleep tracking pattern: baseline questionnaire → daily logging → metrics & risk assessment.

## Architecture Pattern

The alcohol tracking follows the same flow as sleep tracking:

1. **Baseline Questionnaire** (One-time, required at onboarding)
   - Captures typical drinking pattern over past 3 months
   - Required before user can log daily consumption

2. **Daily Logging** (Ongoing)
   - Log each day's alcohol consumption
   - Auto-computes metrics after each entry

3. **Dashboard/Summary** (Analytics)
   - Shows baseline status, recent records, metrics, risk assessment

## Screen Structure

### 1. AlcoholBaselineScreen.js
**Location:** `mobile/screens/AlcoholBaselineScreen.js`

**Purpose:** One-time questionnaire to establish baseline drinking pattern

**Key Features:**
- Multi-step wizard (5-6 steps)
- Validation at each step
- Progress indicator
- Save to AsyncStorage on completion
- Redirect to daily logging after success

**Step Breakdown:**

#### Step 1: Drinking Frequency
```javascript
{
  question: "How many days per week do you typically drink alcohol?",
  field: "baseline_drinking_days_per_week",
  type: "slider",
  min: 0,
  max: 7,
  unit: "days/week"
}
```

#### Step 2: Drinks Per Occasion
```javascript
{
  question: "On a typical drinking day, how many drinks do you consume?",
  field: "baseline_drinks_per_occasion",
  type: "slider",
  min: 0,
  max: 20,
  unit: "drinks",
  helpText: "1 drink = 12oz beer, 5oz wine, or 1.5oz spirits"
}
```

#### Step 3: Binge Frequency
```javascript
{
  question: "In the past month, how many times did you have 4+ drinks (women) or 5+ drinks (men) in one occasion?",
  field: "baseline_binge_frequency_per_month",
  type: "slider",
  min: 0,
  max: 31,
  unit: "episodes/month"
}
```

#### Step 4: Drinking Pattern
```javascript
{
  question: "Which best describes your drinking pattern?",
  field: "drinking_pattern",
  type: "radio",
  options: [
    { label: "None (I don't drink)", value: "none" },
    { label: "Occasional (special occasions only)", value: "occasional" },
    { label: "Weekends only", value: "weekends" },
    { label: "Regular (most weeks)", value: "regular" },
    { label: "Daily", value: "daily" }
  ]
}
```

#### Step 5: Duration
```javascript
{
  question: "How long have you maintained this drinking pattern?",
  field: "years_at_current_pattern",
  type: "slider",
  min: 0,
  max: 50,
  unit: "years"
}
```

#### Step 6: Meal Context
```javascript
{
  question: "Do you typically drink with meals?",
  field: "drinks_with_meals",
  type: "switch",
  helpText: "Drinking with food reduces diabetes risk"
}
```

**API Integration:**
```javascript
import { createAlcoholBaseline } from '../services/api';

const handleSubmit = async () => {
  try {
    const result = await createAlcoholBaseline(
      formData.baseline_drinking_days_per_week,
      formData.baseline_drinks_per_occasion,
      formData.baseline_binge_frequency_per_month,
      formData.drinking_pattern,
      formData.years_at_current_pattern,
      formData.drinks_with_meals
    );
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('alcohol_baseline_completed', 'true');
    
    // Navigate to daily logging or dashboard
    navigation.navigate('AlcoholTracking');
  } catch (error) {
    Alert.alert('Error', 'Failed to save baseline. Please try again.');
  }
};
```

---

### 2. AlcoholDailyLogScreen.js
**Location:** `mobile/screens/AlcoholDailyLogScreen.js`

**Purpose:** Daily alcohol consumption logging

**Key Features:**
- Date picker (default: today)
- Drinks consumed slider
- Context selector
- Time of day selector
- Optional notes
- Auto-detects binge episodes
- Shows warning for high consumption

**Form Fields:**

#### Date Selection
```javascript
<DatePicker
  value={date}
  onChange={setDate}
  maximumDate={new Date()}
/>
```

#### Drinks Consumed
```javascript
<Slider
  value={drinksConsumed}
  onValueChange={setDrinksConsumed}
  minimumValue={0}
  maximumValue={20}
  step={0.5}
/>
<Text style={styles.value}>{drinksConsumed} drinks</Text>

{/* Show binge warning */}
{drinksConsumed >= (gender === 'female' ? 4 : 5) && (
  <View style={styles.warningBox}>
    <Text style={styles.warningText}>
      ⚠️ This is considered a binge drinking episode
    </Text>
  </View>
)}
```

#### Drinking Context
```javascript
<Picker
  selectedValue={drinkingContext}
  onValueChange={setDrinkingContext}
>
  <Picker.Item label="With meal" value="meal" />
  <Picker.Item label="Social event" value="social" />
  <Picker.Item label="Stress relief" value="stress" />
  <Picker.Item label="Celebration" value="celebration" />
  <Picker.Item label="Other" value="other" />
  <Picker.Item label="No specific context" value="none" />
</Picker>
```

#### Time of Day
```javascript
<SegmentedButtons
  value={timeOfDay}
  onValueChange={setTimeOfDay}
  buttons={[
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' },
    { value: 'night', label: 'Night' }
  ]}
/>
```

#### Notes (Optional)
```javascript
<TextInput
  value={notes}
  onChangeText={setNotes}
  placeholder="Optional notes about this entry..."
  multiline
  numberOfLines={3}
/>
```

**API Integration:**
```javascript
import { logDailyAlcohol } from '../services/api';

const handleSubmit = async () => {
  try {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const result = await logDailyAlcohol(
      dateStr,
      drinksConsumed,
      null, // Auto-detected on backend
      drinkingContext,
      timeOfDay,
      notes || null
    );
    
    Alert.alert('Success', 'Daily alcohol logged successfully!');
    navigation.goBack();
  } catch (error) {
    Alert.alert('Error', error.response?.data?.error || 'Failed to log alcohol');
  }
};
```

---

### 3. AlcoholTrackingScreen.js
**Location:** `mobile/screens/AlcoholTrackingScreen.js`

**Purpose:** Main dashboard showing comprehensive alcohol tracking status

**Key Features:**
- Baseline status card
- Weekly/monthly metrics
- Risk assessment display
- Recent consumption records (last 7-14 days)
- Trend visualization (optional chart)
- Quick actions (log today, retake baseline)

**Layout Sections:**

#### Header Actions
```javascript
<View style={styles.header}>
  <Button onPress={() => navigation.navigate('AlcoholDailyLog')}>
    Log Today
  </Button>
  <Button onPress={() => navigation.navigate('AlcoholBaseline')}>
    Retake Baseline
  </Button>
</View>
```

#### Baseline Status Card
```javascript
{baseline ? (
  <Card style={styles.baselineCard}>
    <Text style={styles.cardTitle}>Your Baseline Pattern</Text>
    <Text>Drinking Days: {baseline.baseline_drinking_days_per_week}/week</Text>
    <Text>Drinks Per Day: {baseline.baseline_drinks_per_occasion}</Text>
    <Text>Pattern: {baseline.drinking_pattern}</Text>
    <Text>Binge Episodes: {baseline.baseline_binge_frequency_per_month}/month</Text>
    <Text style={styles.timestamp}>
      Updated: {new Date(baseline.updated_at).toLocaleDateString()}
    </Text>
  </Card>
) : (
  <Card style={styles.warningCard}>
    <Text>⚠️ Please complete your baseline questionnaire</Text>
    <Button onPress={() => navigation.navigate('AlcoholBaseline')}>
      Start Now
    </Button>
  </Card>
)}
```

#### Metrics Card
```javascript
{metrics && (
  <Card style={styles.metricsCard}>
    <Text style={styles.cardTitle}>Your Consumption Metrics</Text>
    
    {/* 7-day average */}
    <View style={styles.metricRow}>
      <Text>7-Day Average:</Text>
      <Text style={styles.metricValue}>
        {metrics.avg_drinks_per_week_7d?.toFixed(1)} drinks/week
      </Text>
    </View>
    
    {/* 30-day average */}
    <View style={styles.metricRow}>
      <Text>30-Day Average:</Text>
      <Text style={styles.metricValue}>
        {metrics.avg_drinks_per_week_30d?.toFixed(1)} drinks/week
      </Text>
    </View>
    
    {/* Binge episodes */}
    <View style={styles.metricRow}>
      <Text>Binge Episodes (30d):</Text>
      <Text style={styles.metricValue}>
        {metrics.binge_episodes_30d}
      </Text>
    </View>
    
    {/* Variability indicator */}
    <View style={styles.metricRow}>
      <Text>Consistency:</Text>
      <Text style={styles.metricValue}>
        {metrics.consumption_variability < 0.3 ? 'Consistent' : 
         metrics.consumption_variability < 0.5 ? 'Moderate' : 'Variable'}
      </Text>
    </View>
  </Card>
)}
```

#### Risk Assessment Card
```javascript
{risk && (
  <Card style={[styles.riskCard, getRiskStyle(risk.overall_risk_category)]}>
    <Text style={styles.cardTitle}>Diabetes Risk Assessment</Text>
    
    {/* Risk category badge */}
    <View style={styles.riskBadge}>
      <Text style={styles.riskCategory}>
        {risk.overall_risk_category.toUpperCase()}
      </Text>
      <Text style={styles.riskPercentage}>
        {risk.diabetes_risk_increase > 0 ? '+' : ''}
        {risk.diabetes_risk_increase}% risk
      </Text>
    </View>
    
    {/* Risk factors */}
    <Text style={styles.sectionTitle}>Risk Factors:</Text>
    {risk.risk_factors.map((factor, index) => (
      <Text key={index} style={styles.riskFactor}>• {factor}</Text>
    ))}
    
    {/* Recommendations */}
    <Text style={styles.sectionTitle}>Recommendations:</Text>
    {risk.recommendations.map((rec, index) => (
      <Text key={index} style={styles.recommendation}>✓ {rec}</Text>
    ))}
    
    {/* Protective factors (if any) */}
    {risk.protective_factors?.length > 0 && (
      <>
        <Text style={styles.sectionTitle}>Protective Factors:</Text>
        {risk.protective_factors.map((factor, index) => (
          <Text key={index} style={styles.protectiveFactor}>
            ✓ {factor}
          </Text>
        ))}
      </>
    )}
  </Card>
)}
```

#### Recent Records List
```javascript
<Text style={styles.sectionTitle}>Recent Consumption</Text>
<FlatList
  data={records}
  keyExtractor={(item) => item.date}
  renderItem={({ item }) => (
    <Card style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordDate}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
        {item.was_binge_episode && (
          <View style={styles.bingeBadge}>
            <Text style={styles.bingeText}>BINGE</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.recordValue}>
        {item.drinks_consumed} drinks
      </Text>
      
      <View style={styles.recordDetails}>
        <Text style={styles.recordContext}>{item.drinking_context}</Text>
        <Text style={styles.recordTime}>{item.time_of_day}</Text>
      </View>
      
      {item.notes && (
        <Text style={styles.recordNotes}>{item.notes}</Text>
      )}
      
      <Button
        mode="text"
        onPress={() => handleDeleteRecord(item.date)}
      >
        Delete
      </Button>
    </Card>
  )}
/>
```

**API Integration:**
```javascript
import { 
  getAlcoholSummary, 
  deleteDailyAlcoholRecord 
} from '../services/api';

const loadData = async () => {
  try {
    const summary = await getAlcoholSummary();
    setBaseline(summary.baseline);
    setMetrics(summary.metrics);
    setRisk(summary.risk_assessment);
    setRecords(summary.recent_records);
  } catch (error) {
    console.error('Error loading alcohol summary:', error);
  }
};

const handleDeleteRecord = async (date) => {
  Alert.alert(
    'Delete Record',
    'Are you sure you want to delete this entry?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDailyAlcoholRecord(date);
            loadData(); // Refresh data
          } catch (error) {
            Alert.alert('Error', 'Failed to delete record');
          }
        }
      }
    ]
  );
};
```

**Risk Color Coding:**
```javascript
const getRiskStyle = (category) => {
  switch (category) {
    case 'low':
      return { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' };
    case 'moderate':
      return { backgroundColor: '#FFF3E0', borderColor: '#FF9800' };
    case 'high':
      return { backgroundColor: '#FFEBEE', borderColor: '#F44336' };
    case 'very_high':
      return { backgroundColor: '#FCE4EC', borderColor: '#E91E63' };
    default:
      return { backgroundColor: '#F5F5F5', borderColor: '#9E9E9E' };
  }
};
```

---

## Navigation Setup

Add routes to your navigation stack:

```javascript
// In your navigation configuration
<Stack.Screen 
  name="AlcoholTracking" 
  component={AlcoholTrackingScreen}
  options={{ title: 'Alcohol Tracking' }}
/>
<Stack.Screen 
  name="AlcoholBaseline" 
  component={AlcoholBaselineScreen}
  options={{ title: 'Baseline Assessment' }}
/>
<Stack.Screen 
  name="AlcoholDailyLog" 
  component={AlcoholDailyLogScreen}
  options={{ title: 'Log Alcohol Consumption' }}
/>
```

## Onboarding Flow

Integrate baseline check into onboarding:

```javascript
// In your onboarding/profile setup
import { checkAlcoholBaseline } from '../services/api';

useEffect(() => {
  const checkBaseline = async () => {
    try {
      const { has_baseline } = await checkAlcoholBaseline();
      if (!has_baseline) {
        // Redirect to baseline screen
        navigation.navigate('AlcoholBaseline');
      }
    } catch (error) {
      console.error('Error checking baseline:', error);
    }
  };
  
  checkBaseline();
}, []);
```

## Data Refresh Strategy

Implement pull-to-refresh and auto-refresh:

```javascript
const [refreshing, setRefreshing] = useState(false);

const onRefresh = async () => {
  setRefreshing(true);
  await loadData();
  setRefreshing(false);
};

// Auto-refresh on screen focus
useFocusEffect(
  React.useCallback(() => {
    loadData();
  }, [])
);
```

## Validation Rules

### Baseline Validation
- `baseline_drinking_days_per_week`: 0-7
- `baseline_drinks_per_occasion`: 0-20
- `baseline_binge_frequency_per_month`: 0-31
- `drinking_pattern`: Must be one of: none, occasional, weekends, regular, daily
- `years_at_current_pattern`: 0-50
- `drinks_with_meals`: Boolean

### Daily Log Validation
- `date`: Must be today or in the past, YYYY-MM-DD format
- `drinks_consumed`: 0-20 (0.5 increments)
- `drinking_context`: Must be one of: meal, social, stress, celebration, other, none
- `time_of_day`: Must be one of: morning, afternoon, evening, night

## UI/UX Best Practices

1. **Progressive Disclosure**: Show metrics only when baseline exists
2. **Contextual Help**: Include "What is a standard drink?" tooltips
3. **Positive Reinforcement**: Highlight protective factors (drinking with meals, low consumption)
4. **Visual Feedback**: Use color coding for risk levels
5. **Accessibility**: Ensure sliders have accessible labels and values
6. **Error Handling**: Show clear error messages with recovery actions
7. **Loading States**: Display skeletons while fetching data
8. **Empty States**: Show helpful CTAs when no data exists

## Testing Checklist

- [ ] Baseline questionnaire completes and saves correctly
- [ ] Daily logging works for today and past dates
- [ ] Metrics auto-update after logging
- [ ] Risk assessment displays correctly for different consumption levels
- [ ] Delete record functionality works
- [ ] Refresh/pull-to-refresh works
- [ ] Navigation flows correctly
- [ ] Error states display properly
- [ ] Binge episode detection triggers correctly
- [ ] Gender-specific thresholds work (4 vs 5 drinks)

## Evidence-Based Thresholds Reference

### Risk Categories (implemented in backend):
- **Low Risk**: ≤7 drinks/week (8% protective effect)
- **Moderate Risk**: 7-14 drinks/week (neutral)
- **High Risk**: 14-21 drinks/week (43% increased risk)
- **Very High Risk**: >21 drinks/week (58% increased risk)

### Binge Drinking:
- Women: ≥4 drinks in one occasion
- Men: ≥5 drinks in one occasion

### Additional Risk Factors:
- High consumption variability (inconsistent patterns)
- Long duration at heavy drinking (>2 years)
- Drinking without food
- Daily drinking pattern

---

## Next Steps

1. Create `AlcoholBaselineScreen.js` with multi-step wizard
2. Create `AlcoholDailyLogScreen.js` with form validation
3. Refactor existing `AlcoholIntakeScreen.js` → `AlcoholTrackingScreen.js` as dashboard
4. Update navigation routes
5. Test complete flow: baseline → daily log → dashboard
6. Add data visualization (optional: charts for trends)

All API functions are ready in `mobile/services/api.js` - you can start building the screens immediately!
