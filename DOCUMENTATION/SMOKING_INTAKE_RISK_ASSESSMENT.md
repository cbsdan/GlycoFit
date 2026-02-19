# Smoking Intake Risk Assessment Calculation

## Overview

The GlycoFit smoking intake feature uses evidence-based medical research to calculate diabetes risk based on smoking history. This document outlines the calculations and algorithms used.

---

## 1. Pack-Years Calculation

Pack-years is the standard medical metric for quantifying lifetime smoking exposure.

### Formula

```
Pack-Years = (Cigarettes per Day ÷ 20) × Years Smoked
```

**Why divide by 20?**  
One pack of cigarettes contains 20 cigarettes. This normalizes the measurement to "packs per day."

### Frontend Implementation

Since users select cigarette ranges rather than exact numbers, the system uses the midpoint of each range:

| User Selection | Midpoint Used | Category |
|---------------|---------------|----------|
| 0 | 0 | None |
| 1-5 | 3 | Light |
| 6-10 | 8 | Moderate |
| 11-20 | 15 | Heavy |
| >20 | 25 | Very Heavy |

### Examples

**Example 1: Moderate smoker**
- Smokes 8 cigarettes/day for 10 years
- Pack-years = (8 ÷ 20) × 10 = **4.0 pack-years**

**Example 2: Heavy smoker**
- Smokes 15 cigarettes/day for 20 years
- Pack-years = (15 ÷ 20) × 20 = **15.0 pack-years**

**Example 3: Very heavy smoker**
- Smokes 25 cigarettes/day for 30 years
- Pack-years = (25 ÷ 20) × 30 = **37.5 pack-years**

---

## 2. Cumulative Pack-Years Tracking

The system tracks **cumulative pack-years** across all smoking sessions to account for:

- Multiple smoking periods
- Quit and relapse scenarios
- Total lifetime exposure

### Calculation Method

```
Cumulative Pack-Years = Σ(Pack-Years of all sessions)
```

### Example Scenario

| Session | Cigarettes/Day | Years | Pack-Years | Status |
|---------|----------------|-------|------------|--------|
| Session 1 | 10 | 5 | 2.5 | Quit |
| Session 2 | 20 | 8 | 8.0 | Active |
| **Total** | - | - | **10.5** | Current |

**Result:** Cumulative pack-years = 10.5 (used for diabetes risk assessment)

---

## 3. Years Since Quit Calculation

For former smokers, the system calculates time since quitting to assess risk reduction.

### Formula

```
Years Since Quit = (Current Date - Most Recent Quit Date) ÷ 365.25
```

**Note:** Uses 365.25 to account for leap years.

### Implementation

```python
quit_date = datetime.fromisoformat(most_recent_quit['end_date'])
years_since_quit = (datetime.utcnow() - quit_date).days / 365.25
```

---

## 4. Diabetes Risk Assessment Algorithm

The risk assessment is based on peer-reviewed medical research studies.

### Scientific Evidence

| Study | Year | Journal | Key Finding |
|-------|------|---------|-------------|
| Willi et al. | 2007 | JAMA | Active smokers have 44% increased T2D risk |
| Pan et al. | 2015 | Lancet | Dose-response relationship with pack-years |
| Akter et al. | 2017 | Epidemiology | Risk reduction after quitting (5-10+ years) |
| Hur et al. | 2001 | Diabetes Care | Pack-years as predictor of diabetes |

### Risk Levels

The system uses 6 risk levels:

1. **Low** - Minimal risk (never smokers or long-term quitters)
2. **Low-Moderate** - Slightly elevated risk
3. **Moderate** - Moderately elevated risk
4. **Moderate-High** - Concerning risk level
5. **High** - Significantly elevated risk
6. **Very High** - Extremely high risk

---

## 5. Risk Calculation Rules

### For Never Smokers

```
Status: never
Risk Level: low
Risk Score: 1
Explanation: Never smoked - baseline diabetes risk
```

### For Current Smokers

Risk is determined by cumulative pack-years:

| Pack-Years | Risk Level | Risk Score | Diabetes Risk Increase |
|------------|------------|------------|------------------------|
| ≥30 | Very High | 5 | >60% increase |
| 20-29 | High | 4 | ~50% increase |
| 10-19 | Moderate-High | 3 | ~40% increase |
| <10 | Moderate | 3 | ~44% baseline increase |

**Algorithm:**
```python
if cumulative_pack_years >= 30:
    return 'very_high'  # >60% diabetes risk increase
elif cumulative_pack_years >= 20:
    return 'high'        # ~50% increase
elif cumulative_pack_years >= 10:
    return 'moderate_high'  # ~40% increase
else:
    return 'moderate'    # ~44% baseline increase
```

### For Former Smokers

Risk is determined by **both** cumulative pack-years **and** years since quitting:

#### Quit ≥10 Years Ago
- **Any pack-years** → **Low-Moderate Risk**
- Risk substantially reduced, approaching baseline
- Reference: Akter et al., 2017

#### Quit 5-10 Years Ago
| Pack-Years | Risk Level | Risk Score |
|------------|------------|------------|
| ≥20 | Moderate | 3 |
| <20 | Low-Moderate | 2 |

- Risk reduced by 10-30%
- Reference: Akter et al., 2017

#### Quit <5 Years Ago
| Pack-Years | Risk Level | Risk Score |
|------------|------------|------------|
| ≥20 | High | 4 |
| <20 | Moderate-High | 3 |

- Risk still elevated (recent quitters)
- Risk gradually decreasing
- References: Pan et al., 2015; Akter et al., 2017

**Algorithm:**
```python
if years_since_quit >= 10:
    return 'low_moderate'  # Risk approaching baseline
elif years_since_quit >= 5:
    if cumulative_pack_years >= 20:
        return 'moderate'
    else:
        return 'low_moderate'
else:  # <5 years
    if cumulative_pack_years >= 20:
        return 'high'
    else:
        return 'moderate_high'
```

---

## 6. Complete Risk Assessment Function

### Backend Implementation (Python)

```python
def calculate_diabetes_risk(record):
    """
    Calculate diabetes risk based on smoking data
    
    Args:
        record (dict): Smoking intake record containing:
            - current_status: 'never', 'former', or 'current'
            - cumulative_pack_years: Total pack-years
            - years_since_quit: Years since quitting (if applicable)
    
    Returns:
        dict: {
            'risk_level': str,  # 'low', 'low_moderate', 'moderate', etc.
            'risk_score': int,  # 1-5
            'explanation': str  # Detailed explanation with references
        }
    """
    
    current_status = record.get('current_status', 'never')
    cumulative_pack_years = record.get('cumulative_pack_years', 0)
    years_since_quit = record.get('years_since_quit')
    
    # Never smokers
    if current_status == 'never':
        return {
            'risk_level': 'low',
            'risk_score': 1,
            'explanation': 'Never smoked - baseline diabetes risk (Reference: Willi et al., 2007)'
        }
    
    # Current smokers
    elif current_status == 'current':
        if cumulative_pack_years >= 30:
            return {
                'risk_level': 'very_high',
                'risk_score': 5,
                'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - significantly elevated diabetes risk (>60% increase, Pan et al., 2015)'
            }
        elif cumulative_pack_years >= 20:
            return {
                'risk_level': 'high',
                'risk_score': 4,
                'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - high diabetes risk (~50% increase, Pan et al., 2015)'
            }
        elif cumulative_pack_years >= 10:
            return {
                'risk_level': 'moderate_high',
                'risk_score': 3,
                'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - moderate-high diabetes risk (~40% increase, Willi et al., 2007)'
            }
        else:
            return {
                'risk_level': 'moderate',
                'risk_score': 3,
                'explanation': f'Current smoker with {cumulative_pack_years:.1f} pack-years - moderate diabetes risk (Willi et al., 2007)'
            }
    
    # Former smokers
    elif current_status == 'former':
        years_since_quit = years_since_quit or 0
        
        # Long-term quitters (≥10 years)
        if years_since_quit >= 10:
            return {
                'risk_level': 'low_moderate',
                'risk_score': 2,
                'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - risk substantially reduced, approaching baseline (Akter et al., 2017)'
            }
        
        # Medium-term quitters (5-10 years)
        elif years_since_quit >= 5:
            if cumulative_pack_years >= 20:
                return {
                    'risk_level': 'moderate',
                    'risk_score': 3,
                    'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - risk moderately reduced but still elevated (Akter et al., 2017)'
                }
            else:
                return {
                    'risk_level': 'low_moderate',
                    'risk_score': 2,
                    'explanation': f'Quit {years_since_quit:.1f} years ago ({cumulative_pack_years:.1f} pack-years) - risk moderately reduced (Akter et al., 2017)'
                }
        
        # Recent quitters (<5 years)
        else:
            if cumulative_pack_years >= 20:
                return {
                    'risk_level': 'high',
                    'risk_score': 4,
                    'explanation': f'Recently quit ({years_since_quit:.1f} years, {cumulative_pack_years:.1f} pack-years) - risk still elevated, continue healthy lifestyle (Pan et al., 2015)'
                }
            else:
                return {
                    'risk_level': 'moderate_high',
                    'risk_score': 3,
                    'explanation': f'Recently quit ({years_since_quit:.1f} years, {cumulative_pack_years:.1f} pack-years) - risk gradually decreasing (Akter et al., 2017)'
                }
```

---

## 7. Frontend Display

### Risk Level Color Coding

| Risk Level | Color | Hex Code |
|------------|-------|----------|
| Low | Green | `#27AE60` |
| Low-Moderate | Orange | `#F39C12` |
| Moderate | Dark Orange | `#E67E22` |
| Moderate-High | Red | `#E74C3C` |
| High | Dark Red | `#C0392B` |
| Very High | Very Dark Red | `#7F1D1D` |

### Risk Level Icons

| Risk Level | Icon |
|------------|------|
| Low | `shield-check` |
| Low-Moderate | `shield-alert` |
| Moderate | `shield-alert` |
| Moderate-High | `alert-circle` |
| High | `alert-circle` |
| Very High | `alert-circle` |

---

## 8. Data Model Structure

### Session Object
```json
{
  "session_id": "unique_id",
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2025-01-01T00:00:00Z",
  "cigarettes_per_day": "11-20",
  "duration_years": 10,
  "pack_years": 7.5,
  "status": "quit",
  "recorded_at": "2025-01-01T00:00:00Z"
}
```

### User Record
```json
{
  "user_id": "user123",
  "current_status": "former",
  "cumulative_pack_years": 15.5,
  "years_since_quit": 3.2,
  "smoking_sessions": [
    {
      "session_id": "session1",
      "pack_years": 5.0,
      "status": "quit"
    },
    {
      "session_id": "session2",
      "pack_years": 10.5,
      "status": "quit"
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

---

## 9. Medical References

### Full Citations

1. **Willi, C., Bodenmann, P., Ghali, W. A., Faris, P. D., & Cornuz, J. (2007).**  
   *Active smoking and the risk of type 2 diabetes: a systematic review and meta-analysis.*  
   **JAMA**, 298(22), 2654-2664.  
   DOI: 10.1001/jama.298.22.2654

2. **Pan, A., Wang, Y., Talaei, M., Hu, F. B., & Wu, T. (2015).**  
   *Relation of active, passive, and quitting smoking with incident type 2 diabetes: a systematic review and meta-analysis.*  
   **The Lancet Diabetes & Endocrinology**, 3(12), 958-967.  
   DOI: 10.1016/S2213-8587(15)00316-2

3. **Akter, S., Goto, A., & Mizoue, T. (2017).**  
   *Smoking and the risk of type 2 diabetes in Japan: A systematic review and meta-analysis.*  
   **Journal of Epidemiology**, 27(12), 553-561.  
   DOI: 10.1016/j.je.2016.12.017

4. **Hur, N. W., Kim, H. C., Nam, C. M., Jee, S. H., Lee, H. C., & Suh, I. (2001).**  
   *Smoking cessation and risk of type 2 diabetes mellitus: Korea Medical Insurance Corporation Study.*  
   **Diabetes Care**, 24(11), 1924-1925.  
   DOI: 10.2337/diacare.24.11.1924

---

## 10. Usage Examples

### Example 1: Never Smoker
```
Input:
- Status: never
- Pack-years: 0

Output:
- Risk Level: low
- Risk Score: 1
- Explanation: "Never smoked - baseline diabetes risk"
```

### Example 2: Current Heavy Smoker
```
Input:
- Status: current
- Cumulative Pack-years: 25
- Sessions: [
    {cigarettes_per_day: "11-20", duration_years: 15, pack_years: 11.25},
    {cigarettes_per_day: "11-20", duration_years: 18, pack_years: 13.75}
  ]

Output:
- Risk Level: high
- Risk Score: 4
- Explanation: "Current smoker with 25.0 pack-years - high diabetes risk (~50% increase, Pan et al., 2015)"
```

### Example 3: Former Smoker (Long-term Quit)
```
Input:
- Status: former
- Cumulative Pack-years: 15
- Years Since Quit: 12

Output:
- Risk Level: low_moderate
- Risk Score: 2
- Explanation: "Quit 12.0 years ago (15.0 pack-years) - risk substantially reduced, approaching baseline (Akter et al., 2017)"
```

### Example 4: Former Smoker (Recent Quit, High Exposure)
```
Input:
- Status: former
- Cumulative Pack-years: 30
- Years Since Quit: 2

Output:
- Risk Level: high
- Risk Score: 4
- Explanation: "Recently quit (2.0 years, 30.0 pack-years) - risk still elevated, continue healthy lifestyle (Pan et al., 2015)"
```

---

## 11. Key Takeaways

1. **Pack-years is the standard metric** for lifetime smoking exposure
2. **Cumulative tracking is essential** for accurate risk assessment across multiple smoking periods
3. **Risk assessment is evidence-based** on peer-reviewed medical research
4. **Time since quitting matters** - risk decreases significantly after 10+ years
5. **Dose-response relationship** - higher pack-years = higher diabetes risk
6. **Medical accuracy** - all thresholds and risk calculations based on published studies

---

**Document Version:** 1.0  
**Last Updated:** January 4, 2026  
**Author:** GlycoFit Development Team
