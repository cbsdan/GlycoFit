# Step Tracking — Diabetes Risk Assessment

This document describes the diabetes risk assessment algorithm used in GlycoFit's step tracking module.

## Summary
- Uses user `StepBaseline` (onboarding) as prior when short on data.
- Computes metrics over 7 & 30 day windows and derives a risk score (0-100).
- Factors: average steps, days tracked, days meeting goal (10k), step variability, data quality.
- References: Kraus et al. (2019) JAMA; guidelines linking 7,000-10,000 steps to metabolic benefits.

## Algorithm (high level)
1. Collect daily `user_activity` records (source-tagged: `health_connect` or `phone_sensor`).
2. Compute:
   - `avg_steps_7d`, `avg_steps_30d`
   - `days_with_data_7d`, `days_with_data_30d`
   - `days_met_goal_7d`, `days_met_goal_30d` (goal=10,000)
   - `step_variability_30d` (standard deviation)
3. Data confidence weight:
   - <7 days: preliminary (weight 0.3)
   - 7-13 days: moderate (0.5)
   - 14-29 days: good (0.75)
   - >=30 days: high (0.9)
4. Combine baseline and observed data using weights to build `weighted_avg_steps`.
5. Assign penalty/benefit based on `weighted_avg_steps`:
   - <3000: +40
   - 3000-4999: +25
   - 5000-6999: +10
   - 7000-9999: 0
   - >=10000: -5
6. Add penalties for inconsistent activity (e.g., <3 goal-days in last 7 days => +10).
7. Final `risk_score` bounded to 0-100 and mapped to categories: low/moderate/high/very_high.

## Using baselines
- When there is insufficient tracking data (<7 days), the baseline exists as a prior (default 5,000 steps if missing).
- As more daily data arrives, confidence shifts weight to observed measurements.

## Notes & References
- Kraus WE, et al. (2019). Association of daily step count and step intensity with mortality among US adults. JAMA. 323(12):1151-1160.
- Public health guidance: 7,000-10,000 steps/day associated with lower mortality and improved metabolic outcomes.

## Implementation
- `backend/services/step_tracking_service.py` implements the core metrics and assessment.
- `backend/models/step_tracking.py` contains `StepBaseline`, `StepMetrics`, and `StepRiskAssessment` models.
- `mobile/screens/StepCounterScreen.js` aggregates and syncs daily activity to backend at `/api/v1/activity/daily`.

## Suggested Improvements
- Incorporate weight, BMI, fasting glucose if available to refine risk scoring.
- Use time-of-day and step intensity to better estimate insulin sensitivity impact.
- Add a smoothing filter for step anomalies (travel days, device errors).
