"""
Lifestyle Recommendation Service

Provides unified timeline predictions and recommendations for all lifestyle trackers:
- Food intake
- Sleep patterns
- Physical activity (steps)
- Alcohol consumption
- Smoking status

All recommendations are based on peer-reviewed medical research studies.
"""

import math
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class LifestyleRecommendationService:
    """
    Unified service for lifestyle-based health predictions and recommendations.
    
    Research References:
    - Knowler et al., 2002: DPP Study (NEJM)
    - Cappuccio et al., 2010: Sleep and T2D (Diabetes Care)
    - Kraus et al., 2019: Steps and mortality (JAMA)
    - Baliunas et al., 2009: Alcohol and T2D (Diabetes Care)
    - Willi et al., 2007: Smoking and T2D (JAMA)
    """
    
    # ==================== FOOD PREDICTIONS ====================
    
    @staticmethod
    def predict_food_impact(
        avg_glycemic_load: float,
        avg_fiber_grams: float,
        avg_added_sugars: float,
        avg_calories: float,
        duration_days: int,
        baseline_risk_score: float = 50
    ) -> Dict[str, Any]:
        """
        Predicts health impact of sustained dietary patterns.
        
        Based on:
        - Villegas et al., 2007: Shanghai Women's Health Study
        - InterAct Consortium, 2015: Fiber and T2D
        - Brand-Miller et al., 2003: Glycemic load study
        """
        predictions = {
            "current_pattern": {
                "avg_glycemic_load": avg_glycemic_load,
                "avg_fiber_grams": avg_fiber_grams,
                "avg_added_sugars": avg_added_sugars,
                "avg_calories": avg_calories,
                "duration_days": duration_days
            },
            "risk_factors": [],
            "timeline_predictions": {},
            "recommendations": [],
            "research_references": []
        }
        
        risk_modifier = 0
        
        # Glycemic load analysis (optimal < 100)
        if avg_glycemic_load > 150:
            risk_modifier += 0.15
            predictions["risk_factors"].append({
                "factor": "very_high_glycemic_load",
                "value": avg_glycemic_load,
                "optimal": "< 100",
                "risk_increase": "15% T2D risk increase potential",
                "research": "Villegas et al., 2007"
            })
            predictions["recommendations"].append({
                "priority": "high",
                "category": "Glycemic Load",
                "title": "Significantly reduce high-glycemic foods",
                "message": f"Your glycemic load ({avg_glycemic_load:.0f}) is very high. Target: <100",
                "actionable_tips": [
                    "Replace white rice with cauliflower rice or brown rice",
                    "Choose whole grain bread over white bread",
                    "Add protein and fiber to every meal to slow glucose absorption",
                    "Limit sugary snacks and processed foods"
                ]
            })
        elif avg_glycemic_load > 100:
            risk_modifier += 0.08
            predictions["risk_factors"].append({
                "factor": "high_glycemic_load",
                "value": avg_glycemic_load,
                "optimal": "< 100",
                "risk_increase": "8% T2D risk increase potential",
                "research": "Villegas et al., 2007"
            })
            predictions["recommendations"].append({
                "priority": "medium",
                "category": "Glycemic Load",
                "title": "Reduce high-glycemic foods",
                "message": f"Your glycemic load ({avg_glycemic_load:.0f}) is elevated. Target: <100",
                "actionable_tips": [
                    "Choose steel-cut oats over instant oatmeal",
                    "Swap sugary cereals for whole grain options",
                    "Include vegetables with every meal"
                ]
            })
        
        # Fiber analysis (optimal >= 25g)
        if avg_fiber_grams < 15:
            risk_modifier += 0.12
            predictions["risk_factors"].append({
                "factor": "very_low_fiber",
                "value": avg_fiber_grams,
                "optimal": ">= 25g",
                "risk_increase": "12% T2D risk increase potential",
                "research": "InterAct Consortium, 2015"
            })
            predictions["recommendations"].append({
                "priority": "high",
                "category": "Fiber Intake",
                "title": "Significantly increase fiber intake",
                "message": f"Your fiber intake ({avg_fiber_grams:.0f}g) is very low. Target: 25-30g",
                "actionable_tips": [
                    "Add beans or lentils to meals 3-4 times per week",
                    "Include vegetables at every meal",
                    "Choose whole fruits over fruit juice",
                    "Switch to 100% whole grain products"
                ]
            })
        elif avg_fiber_grams < 25:
            risk_modifier += 0.06
            predictions["risk_factors"].append({
                "factor": "low_fiber",
                "value": avg_fiber_grams,
                "optimal": ">= 25g",
                "risk_increase": "6% T2D risk increase potential",
                "research": "InterAct Consortium, 2015"
            })
            predictions["recommendations"].append({
                "priority": "medium",
                "category": "Fiber Intake",
                "title": "Increase fiber intake",
                "message": f"Your fiber intake ({avg_fiber_grams:.0f}g) is below optimal. Target: 25-30g",
                "actionable_tips": [
                    "Add chia seeds or flaxseeds to breakfast",
                    "Snack on nuts and seeds instead of chips",
                    "Include a salad with lunch and dinner"
                ]
            })
        else:
            # Protective effect of adequate fiber
            risk_modifier -= 0.05
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Fiber Intake",
                "title": "Great fiber intake!",
                "message": f"Your fiber intake ({avg_fiber_grams:.0f}g) is excellent. Keep it up!",
                "protective_effect": "May reduce T2D risk by 15-30%",
                "research": "InterAct Consortium, 2015"
            })
        
        # Added sugars analysis (optimal <= 25g - WHO recommendation)
        if avg_added_sugars > 50:
            risk_modifier += 0.15
            predictions["risk_factors"].append({
                "factor": "very_high_added_sugars",
                "value": avg_added_sugars,
                "optimal": "<= 25g",
                "risk_increase": "15% T2D risk increase potential",
                "research": "WHO Sugar Guidelines, 2015"
            })
            predictions["recommendations"].append({
                "priority": "high",
                "category": "Added Sugars",
                "title": "Dramatically reduce added sugar intake",
                "message": f"Your added sugar intake ({avg_added_sugars:.0f}g) is double the recommended limit",
                "actionable_tips": [
                    "Eliminate sugary drinks (sodas, sweetened coffee/tea)",
                    "Replace candy with fresh fruit",
                    "Read labels - many 'healthy' foods contain hidden sugars",
                    "Use spices like cinnamon instead of sugar"
                ]
            })
        elif avg_added_sugars > 25:
            risk_modifier += 0.08
            predictions["risk_factors"].append({
                "factor": "high_added_sugars",
                "value": avg_added_sugars,
                "optimal": "<= 25g",
                "risk_increase": "8% T2D risk increase potential",
                "research": "WHO Sugar Guidelines, 2015"
            })
            predictions["recommendations"].append({
                "priority": "medium",
                "category": "Added Sugars",
                "title": "Reduce added sugar intake",
                "message": f"Your added sugar intake ({avg_added_sugars:.0f}g) exceeds the 25g limit",
                "actionable_tips": [
                    "Cut sugary drink consumption in half",
                    "Choose plain yogurt and add fruit yourself",
                    "Limit desserts to occasional treats"
                ]
            })
        
        # Calculate timeline predictions
        time_factor = math.log10(max(duration_days, 1) + 1) / 3
        projected_risk_increase = risk_modifier * time_factor * 100
        
        predictions["timeline_predictions"] = {
            "3_months": {
                "projected_risk_change": f"+{min(projected_risk_increase * 0.25, 5):.1f}%",
                "key_impact": "Early insulin resistance markers may appear" if risk_modifier > 0.1 else "Maintaining current health status",
                "description": f"With avg glycemic load of {avg_glycemic_load:.0f} and {avg_fiber_grams:.0f}g fiber, your cells' responsiveness to insulin begins to decline, making blood sugar regulation harder." if risk_modifier > 0.1 else f"Your balanced diet (GL: {avg_glycemic_load:.0f}, fiber: {avg_fiber_grams:.0f}g) maintains healthy insulin sensitivity.",
                "research": "Brand-Miller et al., 2003"
            },
            "6_months": {
                "projected_risk_change": f"+{min(projected_risk_increase * 0.5, 10):.1f}%",
                "key_impact": "HbA1c may increase by 0.2-0.3%" if risk_modifier > 0.1 else "Stable metabolic markers expected",
                "description": "Sustained high glycemic load causes chronic glucose elevation. Your pancreas works overtime, leading to measurable HbA1c increases." if risk_modifier > 0.1 else "Your dietary pattern promotes stable blood sugar levels and prevents pancreatic stress.",
                "research": "DPP Research Group, 2002"
            },
            "1_year": {
                "projected_risk_change": f"+{min(projected_risk_increase, 20):.1f}%",
                "key_impact": "Significant metabolic changes likely" if risk_modifier > 0.15 else "Low risk if pattern maintained",
                "description": f"One year of suboptimal eating patterns (high GL, low fiber, excess sugar) creates persistent metabolic dysfunction and {min(projected_risk_increase, 20):.0f}% increased diabetes risk." if risk_modifier > 0.15 else f"Your healthy eating over 1 year strengthens metabolic resilience and maintains protective factors.",
                "intervention_potential": f"Dietary changes now could prevent {min(projected_risk_increase * 0.7, 15):.0f}% risk increase",
                "research": "Finnish Diabetes Prevention Study, 2006"
            }
        }
        
        predictions["research_references"] = [
            "Villegas et al., 2007: Glycemic load and T2D risk",
            "InterAct Consortium, 2015: Fiber intake and T2D",
            "WHO Sugar Guidelines, 2015",
            "Finnish Diabetes Prevention Study, 2006"
        ]
        
        return predictions
    
    # ==================== SLEEP PREDICTIONS ====================
    
    @staticmethod
    def predict_sleep_impact(
        avg_sleep_hours: float,
        sleep_variability_hours: Optional[float],
        bedtime_variability_minutes: Optional[float],
        duration_days: int
    ) -> Dict[str, Any]:
        """
        Predicts health impact of sustained sleep patterns.
        
        Based on:
        - Cappuccio et al., 2010: Sleep and T2D meta-analysis
        - Spiegel et al., 1999: Sleep debt impact
        - Huang et al., 2020: Sleep regularity study
        """
        predictions = {
            "current_pattern": {
                "avg_sleep_hours": avg_sleep_hours,
                "sleep_variability_hours": sleep_variability_hours,
                "bedtime_variability_minutes": bedtime_variability_minutes,
                "duration_days": duration_days
            },
            "risk_factors": [],
            "timeline_predictions": {},
            "recommendations": [],
            "research_references": []
        }
        
        risk_modifier = 0
        
        # Short sleep analysis
        if avg_sleep_hours < 5:
            risk_modifier += 0.35
            predictions["risk_factors"].append({
                "factor": "very_short_sleep",
                "value": avg_sleep_hours,
                "optimal": "7-8 hours",
                "risk_increase": "35% T2D risk increase",
                "research": "Cappuccio et al., 2010"
            })
            predictions["recommendations"].append({
                "priority": "critical",
                "category": "Sleep Duration",
                "title": "Your sleep duration is critically low",
                "message": f"Averaging {avg_sleep_hours:.1f} hours significantly increases diabetes risk",
                "timeline_impact": {
                    "1_week": "16% decrease in insulin sensitivity",
                    "1_month": "Elevated cortisol and increased appetite",
                    "6_months": "Chronic metabolic dysfunction",
                    "1_year": "35%+ increased T2D risk"
                },
                "actionable_tips": [
                    "Set a non-negotiable bedtime",
                    "Create a sleep-promoting environment (cool, dark, quiet)",
                    "Avoid screens 1 hour before bed",
                    "Limit caffeine after 2 PM",
                    "Consider speaking with a doctor about sleep issues"
                ]
            })
        elif avg_sleep_hours < 6:
            risk_modifier += 0.28
            predictions["risk_factors"].append({
                "factor": "short_sleep",
                "value": avg_sleep_hours,
                "optimal": "7-8 hours",
                "risk_increase": "28% T2D risk increase",
                "research": "Cappuccio et al., 2010"
            })
            predictions["recommendations"].append({
                "priority": "high",
                "category": "Sleep Duration",
                "title": "Your sleep duration is too short",
                "message": f"Averaging {avg_sleep_hours:.1f} hours increases diabetes risk by 28%",
                "actionable_tips": [
                    "Go to bed 15 minutes earlier each week until reaching 7 hours",
                    "Create a consistent bedtime routine",
                    "Avoid heavy meals close to bedtime",
                    "Exercise during the day (but not close to bedtime)"
                ]
            })
        elif avg_sleep_hours > 9:
            risk_modifier += 0.20
            predictions["risk_factors"].append({
                "factor": "long_sleep",
                "value": avg_sleep_hours,
                "optimal": "7-8 hours",
                "risk_increase": "20% T2D risk increase (may indicate underlying issues)",
                "research": "Cappuccio et al., 2010"
            })
            predictions["recommendations"].append({
                "priority": "medium",
                "category": "Sleep Duration",
                "title": "Your sleep duration is longer than optimal",
                "message": f"Sleeping {avg_sleep_hours:.1f} hours may indicate underlying health issues",
                "actionable_tips": [
                    "Consider consulting a healthcare provider",
                    "Evaluate sleep quality - you may not be getting restful sleep",
                    "Check for sleep apnea or other sleep disorders",
                    "Maintain a consistent sleep schedule"
                ]
            })
        elif 7 <= avg_sleep_hours <= 8:
            risk_modifier -= 0.05
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Sleep Duration",
                "title": "Excellent sleep duration!",
                "message": f"Your {avg_sleep_hours:.1f} hours of sleep is in the optimal range",
                "protective_effect": "Optimal sleep duration supports metabolic health"
            })
        
        # Sleep variability analysis (only meaningful with 14+ days of data)
        if sleep_variability_hours is not None and duration_days >= 14:
            if sleep_variability_hours > 1.5:
                risk_modifier += 0.15
                predictions["risk_factors"].append({
                    "factor": "high_sleep_variability",
                    "value": f"{sleep_variability_hours:.1f} hours SD",
                    "optimal": "< 1 hour SD",
                    "risk_increase": "15% increased metabolic risk",
                    "research": "Huang et al., 2020"
                })
                predictions["recommendations"].append({
                    "priority": "medium",
                    "category": "Sleep Consistency",
                    "title": "Your sleep duration varies too much",
                    "message": "High variability in sleep duration disrupts metabolism",
                    "actionable_tips": [
                        "Set consistent bed and wake times (even on weekends)",
                        "Limit 'sleep catch-up' on weekends to 1 hour",
                        "Use sleep tracking to identify patterns"
                    ]
                })
        
        # Bedtime variability analysis
        if bedtime_variability_minutes is not None and duration_days >= 14:
            if bedtime_variability_minutes > 90:
                risk_modifier += 0.10
                predictions["risk_factors"].append({
                    "factor": "high_bedtime_variability",
                    "value": f"{bedtime_variability_minutes:.0f} minutes SD",
                    "optimal": "< 60 minutes SD",
                    "risk_increase": "10% increased metabolic risk",
                    "research": "Huang et al., 2020"
                })
                predictions["recommendations"].append({
                    "priority": "medium",
                    "category": "Sleep Timing",
                    "title": "Your bedtime varies significantly",
                    "message": "Inconsistent bedtimes disrupt circadian rhythm and metabolism",
                    "actionable_tips": [
                        "Set a consistent bedtime alarm",
                        "Avoid large variations on weekends",
                        "Create evening routines that signal sleep time"
                    ]
                })
        
        # Calculate timeline predictions
        predictions["timeline_predictions"] = {
            "1_week": {
                "impact": "16% decrease in insulin sensitivity if sleep-deprived" if avg_sleep_hours < 6 else "Stable",
                "description": "Short sleep rapidly affects insulin sensitivity. Your body's ability to regulate blood sugar is already being impaired." if avg_sleep_hours < 6 else "Your current sleep pattern maintains stable glucose metabolism.",
                "research": "Spiegel et al., 1999"
            },
            "1_month": {
                "impact": "Elevated cortisol and appetite hormones" if avg_sleep_hours < 6 else "Maintaining metabolic balance",
                "description": "Chronic sleep deprivation disrupts leptin and ghrelin (hunger hormones), increasing cravings for high-calorie foods." if avg_sleep_hours < 6 else "Adequate sleep keeps hunger hormones balanced, helping you maintain healthy eating habits.",
                "research": "Taheri et al., 2004"
            },
            "6_months": {
                "projected_risk_change": f"+{risk_modifier * 50:.0f}%" if risk_modifier > 0 else "No increased risk",
                "impact": "Chronic metabolic changes" if risk_modifier > 0.2 else "Stable metabolic markers",
                "description": f"Sustained sleep patterns like yours (avg {avg_sleep_hours:.1f}h) lead to cumulative metabolic dysfunction and weight gain." if risk_modifier > 0.2 else f"Your {avg_sleep_hours:.1f}h average sleep duration supports long-term metabolic health.",
                "research": "Buxton et al., 2012"
            },
            "1_year": {
                "projected_risk_change": f"+{risk_modifier * 100:.0f}%" if risk_modifier > 0 else "Protective",
                "impact": f"{int(risk_modifier * 100)}% increased T2D risk" if risk_modifier > 0 else "Optimal sleep supports metabolic health",
                "description": f"At {avg_sleep_hours:.1f}h per night, epidemiological studies show a {int(risk_modifier * 100)}% increased risk of type 2 diabetes. This is due to prolonged insulin resistance and metabolic stress." if risk_modifier > 0 else f"Maintaining {avg_sleep_hours:.1f}h of sleep per night provides long-term protection against metabolic disease.",
                "intervention_potential": f"Improving sleep now could prevent this risk increase",
                "research": "Cappuccio et al., 2010"
            }
        }
        
        predictions["research_references"] = [
            "Cappuccio et al., 2010: Sleep duration meta-analysis",
            "Spiegel et al., 1999: Sleep debt and metabolism",
            "Huang et al., 2020: Sleep regularity study",
            "Taheri et al., 2004: Sleep and appetite hormones"
        ]
        
        return predictions
    
    # ==================== ACTIVITY PREDICTIONS ====================
    
    @staticmethod
    def predict_activity_impact(
        avg_daily_steps: int,
        days_goal_met: int,
        duration_days: int,
        step_goal: int = 10000
    ) -> Dict[str, Any]:
        """
        Predicts health impact of sustained activity levels.
        
        Based on:
        - Kraus et al., 2019: Step count and mortality
        - Patterson et al., 2018: Sedentary behavior and T2D
        - Physical Activity Guidelines Advisory Committee, 2018
        """
        predictions = {
            "current_pattern": {
                "avg_daily_steps": avg_daily_steps,
                "days_goal_met": days_goal_met,
                "duration_days": duration_days,
                "goal_achievement_rate": (days_goal_met / max(duration_days, 1)) * 100
            },
            "activity_category": "",
            "risk_factors": [],
            "timeline_predictions": {},
            "recommendations": [],
            "research_references": []
        }
        
        risk_modifier = 0
        
        # Categorize activity level
        if avg_daily_steps < 3000:
            predictions["activity_category"] = "highly_sedentary"
            risk_modifier = 0.35
            predictions["risk_factors"].append({
                "factor": "highly_sedentary",
                "value": avg_daily_steps,
                "optimal": "7,000-10,000 steps",
                "risk_increase": "35% T2D risk increase",
                "research": "Patterson et al., 2018"
            })
            predictions["recommendations"].append({
                "priority": "critical",
                "category": "Physical Activity",
                "title": "Your activity level is critically low",
                "message": f"Averaging {avg_daily_steps:,} steps/day significantly increases health risks",
                "progressive_goals": {
                    "week_1": "Add 500 steps daily (5-minute walk)",
                    "week_2": "Add 1,000 steps daily total",
                    "week_4": "Aim for 5,000 steps daily",
                    "month_2": "Work toward 7,000 steps daily"
                },
                "actionable_tips": [
                    "Take short walking breaks every hour",
                    "Park farther from destinations",
                    "Use stairs instead of elevators",
                    "Walk while on phone calls"
                ]
            })
        elif avg_daily_steps < 5000:
            predictions["activity_category"] = "sedentary"
            risk_modifier = 0.25
            predictions["risk_factors"].append({
                "factor": "sedentary",
                "value": avg_daily_steps,
                "optimal": "7,000-10,000 steps",
                "risk_increase": "25% T2D risk increase",
                "research": "Patterson et al., 2018"
            })
            predictions["recommendations"].append({
                "priority": "high",
                "category": "Physical Activity",
                "title": "Your activity level is below optimal",
                "message": f"Averaging {avg_daily_steps:,} steps/day puts you at moderate risk",
                "actionable_tips": [
                    "Add a 15-minute walk after each meal",
                    "Set hourly reminders to move",
                    "Try a standing desk for part of the day",
                    "Goal: Add 2,000 steps per day over next month"
                ]
            })
        elif avg_daily_steps < 7500:
            predictions["activity_category"] = "light_active"
            risk_modifier = 0.10
            predictions["risk_factors"].append({
                "factor": "light_active",
                "value": avg_daily_steps,
                "optimal": "7,000-10,000 steps",
                "risk_increase": "10% residual risk",
                "research": "Kraus et al., 2019"
            })
            predictions["recommendations"].append({
                "priority": "medium",
                "category": "Physical Activity",
                "title": "You're approaching optimal activity",
                "message": f"Averaging {avg_daily_steps:,} steps/day is good, but there's room to improve",
                "actionable_tips": [
                    "Add a 20-minute walk daily to reach 7,000+ steps",
                    "Consider adding structured exercise 2-3x per week",
                    "Weekend activities: hiking, cycling, swimming"
                ]
            })
        elif avg_daily_steps < 10000:
            predictions["activity_category"] = "active"
            risk_modifier = 0
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Physical Activity",
                "title": "Great activity level!",
                "message": f"Averaging {avg_daily_steps:,} steps/day is optimal for health",
                "protective_effect": "7,000-10,000 steps associated with 50-65% lower mortality",
                "maintenance_tips": [
                    "Maintain consistency throughout the week",
                    "Consider adding strength training 2x/week",
                    "Vary activities to prevent overuse injuries"
                ]
            })
        else:
            predictions["activity_category"] = "highly_active"
            risk_modifier = -0.10
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Physical Activity",
                "title": "Excellent activity level!",
                "message": f"Averaging {avg_daily_steps:,} steps/day is excellent",
                "protective_effect": "High activity provides significant metabolic protection",
                "maintenance_tips": [
                    "Ensure adequate recovery days",
                    "Focus on injury prevention",
                    "Consider variety in activities"
                ]
            })
        
        # Calculate timeline predictions
        predictions["timeline_predictions"] = {
            "1_week": {
                "impact": "Insulin sensitivity decrease by 10-15%" if avg_daily_steps < 5000 else "Maintaining metabolic benefits",
                "description": f"At {avg_daily_steps:,} steps/day, your muscles become less responsive to insulin within just 1 week. Sedentary behavior rapidly impairs glucose uptake." if avg_daily_steps < 5000 else f"Your {avg_daily_steps:,} daily steps keep muscles sensitive to insulin and glucose metabolism active.",
                "reversible": True,
                "research": "Thyfault & Krogh-Madsen, 2011"
            },
            "1_month": {
                "impact": "Elevated fasting glucose likely" if avg_daily_steps < 5000 else "Stable glucose levels",
                "description": "Prolonged physical inactivity causes muscle glucose uptake to decline, leading to chronically elevated blood sugar even when fasting." if avg_daily_steps < 5000 else "Regular physical activity maintains healthy fasting glucose levels by keeping muscles active in glucose disposal.",
                "reversible": True,
                "research": "Mikus et al., 2012"
            },
            "6_months": {
                "projected_risk_change": f"+{risk_modifier * 60:.0f}%" if risk_modifier > 0 else f"{risk_modifier * 60:.0f}%",
                "impact": "Metabolic dysfunction progressing" if risk_modifier > 0.2 else "Metabolic health maintained",
                "description": f"Six months of low activity ({avg_daily_steps:,} steps/day) leads to fat accumulation, especially visceral fat, which secretes inflammatory molecules that impair insulin function." if risk_modifier > 0.2 else f"Maintaining {avg_daily_steps:,} steps/day for 6 months builds strong metabolic protection through improved body composition and insulin sensitivity.",
                "research": "Grøntved & Hu, 2011"
            },
            "1_year": {
                "projected_risk_change": f"+{risk_modifier * 100:.0f}%" if risk_modifier > 0 else f"{risk_modifier * 100:.0f}%",
                "impact": f"{int(risk_modifier * 100)}% T2D risk change",
                "description": f"A full year at {avg_daily_steps:,} steps/day creates cumulative metabolic damage: reduced muscle mass, increased fat mass, chronic low-grade inflammation, and {int(risk_modifier * 100)}% higher diabetes risk." if risk_modifier > 0 else f"One year of consistent activity at {avg_daily_steps:,} steps/day provides lasting metabolic benefits and reduces diabetes risk significantly.",
                "intervention_potential": f"Increasing activity now could prevent {int(risk_modifier * 70)}% risk increase" if risk_modifier > 0 else "Continue to maintain benefits",
                "research": "Patterson et al., 2018"
            }
        }
        
        predictions["research_references"] = [
            "Kraus et al., 2019: Step count and mortality (JAMA)",
            "Patterson et al., 2018: Sedentary behavior and T2D",
            "Physical Activity Guidelines Advisory Committee, 2018"
        ]
        
        return predictions
    
    # ==================== ALCOHOL PREDICTIONS ====================
    
    @staticmethod
    def predict_alcohol_impact(
        drinks_per_week: float,
        binge_episodes_monthly: int,
        duration_days: int,
        gender: str = 'male'
    ) -> Dict[str, Any]:
        """
        Predicts health impact of sustained alcohol consumption patterns.
        
        Based on:
        - Baliunas et al., 2009: Diabetes Care meta-analysis
        - NIAAA drinking guidelines
        - Roerecke & Rehm, 2014: Alcohol and cardiovascular disease
        """
        predictions = {
            "current_pattern": {
                "drinks_per_week": drinks_per_week,
                "binge_episodes_monthly": binge_episodes_monthly,
                "duration_days": duration_days,
                "gender": gender
            },
            "risk_category": "",
            "risk_multiplier": 1.0,
            "risk_factors": [],
            "timeline_predictions": {},
            "recommendations": [],
            "research_references": []
        }
        
        # Gender-specific thresholds
        heavy_threshold = 14 if gender == 'male' else 7
        moderate_threshold = 7 if gender == 'male' else 4
        
        if drinks_per_week == 0:
            predictions["risk_category"] = "none"
            predictions["risk_multiplier"] = 1.0
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Alcohol",
                "title": "Non-drinker status",
                "message": "Abstinence from alcohol maintains baseline diabetes risk",
                "note": "No need to start drinking for health benefits"
            })
        elif drinks_per_week <= 3:
            predictions["risk_category"] = "light"
            predictions["risk_multiplier"] = 0.95
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Alcohol",
                "title": "Light drinking pattern",
                "message": "Light alcohol consumption (≤3/week) shows neutral to slightly protective effects",
                "protective_effect": "May have slight protective effect against T2D",
                "maintenance_tips": [
                    "Continue limiting to current levels",
                    "Avoid progression to heavier drinking"
                ],
                "research": "Baliunas et al., 2009"
            })
        elif drinks_per_week <= moderate_threshold:
            predictions["risk_category"] = "moderate"
            predictions["risk_multiplier"] = 1.0
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Alcohol",
                "title": "Moderate drinking pattern",
                "message": "Your alcohol intake is within moderate guidelines",
                "caution": "Be mindful not to exceed current levels",
                "research": "NIAAA Guidelines"
            })
        elif drinks_per_week <= heavy_threshold:
            predictions["risk_category"] = "heavy"
            predictions["risk_multiplier"] = 1.43
            predictions["risk_factors"].append({
                "factor": "heavy_drinking",
                "value": drinks_per_week,
                "threshold": f">{moderate_threshold} drinks/week",
                "risk_increase": "43% T2D risk increase",
                "research": "Baliunas et al., 2009"
            })
            predictions["recommendations"].append({
                "priority": "high",
                "category": "Alcohol",
                "title": "Heavy drinking pattern detected",
                "message": f"Consuming {drinks_per_week:.0f} drinks/week increases T2D risk by 43%",
                "reduction_goals": [
                    f"Reduce to <{moderate_threshold} drinks/week over 4-6 weeks",
                    "Set maximum 2 drinks per occasion",
                    "Designate 3+ alcohol-free days per week"
                ],
                "actionable_tips": [
                    "Track each drink to maintain awareness",
                    "Alternate alcoholic drinks with water",
                    "Avoid keeping alcohol at home",
                    "Find alternative stress relief methods"
                ]
            })
        else:
            predictions["risk_category"] = "very_heavy"
            predictions["risk_multiplier"] = 1.55
            predictions["risk_factors"].append({
                "factor": "very_heavy_drinking",
                "value": drinks_per_week,
                "threshold": f">{heavy_threshold} drinks/week",
                "risk_increase": "55% T2D risk increase",
                "research": "Baliunas et al., 2009"
            })
            predictions["recommendations"].append({
                "priority": "critical",
                "category": "Alcohol",
                "title": "Very heavy drinking pattern",
                "message": f"Consuming {drinks_per_week:.0f} drinks/week significantly elevates health risks",
                "urgent_actions": [
                    "Consider consulting with a healthcare provider",
                    "Seek support from alcohol counseling services",
                    "Reduce consumption gradually to avoid withdrawal"
                ],
                "research": "Baliunas et al., 2009"
            })
        
        # Binge drinking additional risk
        if binge_episodes_monthly >= 1:
            predictions["risk_factors"].append({
                "factor": "binge_drinking",
                "value": f"{binge_episodes_monthly} episodes/month",
                "risk_increase": "Additional 12% T2D risk",
                "research": "NIAAA Binge Drinking Guidelines"
            })
            predictions["risk_multiplier"] += 0.12
            predictions["recommendations"].append({
                "priority": "high",
                "category": "Binge Drinking",
                "title": "Binge drinking episodes detected",
                "message": "Binge drinking causes acute blood sugar dysregulation",
                "actionable_tips": [
                    "Set a firm limit before drinking events (max 2 drinks)",
                    "Alternate alcoholic drinks with water",
                    "Eat a meal before drinking",
                    "Plan transportation to avoid extended drinking sessions"
                ]
            })
        
        # Calculate timeline predictions for heavy/very heavy
        if predictions["risk_category"] in ["heavy", "very_heavy"]:
            predictions["timeline_predictions"] = {
                "1_month": {
                    "impact": "Liver enzyme elevation likely",
                    "description": f"At {drinks_per_week:.0f} drinks/week, your liver becomes stressed processing alcohol, causing enzyme elevations (ALT, AST). The liver prioritizes alcohol metabolism over glucose regulation.",
                    "reversible": True,
                    "research": "Rehm et al., 2010"
                },
                "3_months": {
                    "impact": "Early fatty liver changes may occur",
                    "description": "Chronic heavy drinking causes fat accumulation in liver cells (hepatic steatosis). This impairs the liver's ability to regulate blood sugar and increases insulin resistance.",
                    "reversible": True,
                    "research": "Zakhari & Li, 2007"
                },
                "6_months": {
                    "impact": "Chronic inflammation and insulin resistance",
                    "description": "Six months of heavy drinking creates persistent liver inflammation, disrupts pancreatic function, and impairs insulin signaling pathways throughout the body.",
                    "partially_reversible": True,
                    "research": "Kim et al., 2019"
                },
                "1_year": {
                    "projected_risk_change": f"+{(predictions['risk_multiplier'] - 1) * 100:.0f}%",
                    "impact": f"{int((predictions['risk_multiplier'] - 1) * 100)}% increased T2D risk",
                    "description": f"One year at {drinks_per_week:.0f} drinks/week causes cumulative damage: fatty liver, chronic inflammation, pancreatic dysfunction, and {int((predictions['risk_multiplier'] - 1) * 100)}% higher diabetes risk.",
                    "intervention_potential": "Reducing alcohol now could largely prevent this risk increase",
                    "research": "Baliunas et al., 2009"
                }
            }
        else:
            predictions["timeline_predictions"] = {
                "1_year": {
                    "impact": "Neutral to slightly protective effect maintained",
                    "description": f"Light to moderate drinking ({drinks_per_week:.0f} drinks/week) shows neutral to slightly protective effects on insulin sensitivity, but increasing consumption would eliminate this benefit.",
                    "research": "Baliunas et al., 2009"
                }
            }
        
        predictions["research_references"] = [
            "Baliunas et al., 2009: Alcohol and T2D meta-analysis",
            "NIAAA Drinking Guidelines",
            "Roerecke & Rehm, 2014: Alcohol and CVD"
        ]
        
        return predictions
    
    # ==================== SMOKING PREDICTIONS ====================
    
    @staticmethod
    def predict_smoking_impact(
        smoking_status: str,
        pack_years: float,
        years_since_quit: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Predicts health impact of smoking history.
        
        Based on:
        - Willi et al., 2007: JAMA meta-analysis
        - Pan et al., 2015: Lancet dose-response study
        - Akter et al., 2017: Quitting benefits study
        """
        predictions = {
            "current_pattern": {
                "smoking_status": smoking_status,
                "pack_years": pack_years,
                "years_since_quit": years_since_quit
            },
            "risk_category": "",
            "risk_multiplier": 1.0,
            "risk_factors": [],
            "timeline_predictions": {},
            "recommendations": [],
            "research_references": []
        }
        
        if smoking_status == "never":
            predictions["risk_category"] = "none"
            predictions["risk_multiplier"] = 1.0
            predictions["recommendations"].append({
                "priority": "low",
                "category": "Smoking",
                "title": "Excellent! Never smoker status",
                "message": "Never smoking is one of the best things for your metabolic health",
                "protective_effect": "Avoiding smoking prevents 44%+ T2D risk increase",
                "maintenance_tips": [
                    "Continue avoiding tobacco products",
                    "Minimize secondhand smoke exposure"
                ],
                "research": "Willi et al., 2007"
            })
        
        elif smoking_status == "current":
            # Dose-response based on pack-years
            if pack_years >= 30:
                predictions["risk_category"] = "very_high"
                predictions["risk_multiplier"] = 1.60
            elif pack_years >= 20:
                predictions["risk_category"] = "high"
                predictions["risk_multiplier"] = 1.55
            elif pack_years >= 10:
                predictions["risk_category"] = "moderate_high"
                predictions["risk_multiplier"] = 1.50
            else:
                predictions["risk_category"] = "moderate"
                predictions["risk_multiplier"] = 1.44
            
            predictions["risk_factors"].append({
                "factor": "current_smoking",
                "pack_years": pack_years,
                "risk_increase": f"{int((predictions['risk_multiplier'] - 1) * 100)}% T2D risk increase",
                "research": "Willi et al., 2007; Pan et al., 2015"
            })
            
            predictions["recommendations"].append({
                "priority": "critical",
                "category": "Smoking",
                "title": "Smoking significantly increases your diabetes risk",
                "message": f"With {pack_years:.0f} pack-years, your T2D risk is increased by {int((predictions['risk_multiplier'] - 1) * 100)}%",
                "quitting_benefits": {
                    "immediate": "Heart rate and blood pressure drop within 20 minutes",
                    "1_year": "Risk begins to decline",
                    "5_years": "Risk reduced by 30-40% from current",
                    "10_years": "Risk approaches non-smoker levels"
                },
                "quitting_resources": [
                    "Speak with your doctor about cessation aids",
                    "Consider nicotine replacement therapy",
                    "Use smoking cessation apps and support groups",
                    "Set a quit date and tell friends/family"
                ],
                "research": "Akter et al., 2017"
            })
            
            predictions["timeline_predictions"] = {
                "continued_1_year": {
                    "additional_pack_years": f"+{pack_years / max(1, pack_years) * 1:.1f}",
                    "impact": "Continued cumulative damage",
                    "description": f"Continuing to smoke adds more pack-years ({pack_years:.0f} currently), worsening oxidative stress, inflammation, and direct pancreatic beta-cell damage. Each cigarette impairs insulin secretion and action.",
                    "research": "Pan et al., 2015"
                },
                "if_quit_now": {
                    "1_year": "Risk starts to decline",
                    "1_year_description": "Within 1 year of quitting, inflammation markers decrease, blood vessel function improves, and insulin sensitivity begins recovering. Your diabetes risk starts its downward trajectory.",
                    "5_years": "30-40% risk reduction from current",
                    "5_years_description": "After 5 smoke-free years, oxidative damage is significantly reduced, lung function improves, and your diabetes risk decreases by 30-40% compared to continuing smoking.",
                    "10_years": "Approaches non-smoker risk",
                    "10_years_description": f"Ten years smoke-free allows near-complete pancreatic recovery (unless permanent damage occurred). Your {pack_years:.0f} pack-year history becomes less relevant as metabolic function normalizes.",
                    "research": "Akter et al., 2017"
                }
            }
        
        elif smoking_status == "former":
            if years_since_quit is None:
                years_since_quit = 0
            
            # Risk reduction based on years since quit
            if years_since_quit >= 10:
                predictions["risk_category"] = "low_moderate"
                predictions["risk_multiplier"] = 1.10
                predictions["recommendations"].append({
                    "priority": "low",
                    "category": "Smoking",
                    "title": "Your risk has significantly reduced",
                    "message": f"After {years_since_quit:.0f} years smoke-free, your risk approaches non-smoker levels",
                    "protective_achievement": "Major risk reduction achieved through sustained abstinence",
                    "maintenance_tips": [
                        "Continue smoke-free lifestyle",
                        "Focus on other lifestyle factors for continued health"
                    ],
                    "research": "Akter et al., 2017"
                })
            elif years_since_quit >= 5:
                if pack_years >= 20:
                    predictions["risk_category"] = "moderate"
                    predictions["risk_multiplier"] = 1.25
                else:
                    predictions["risk_category"] = "low_moderate"
                    predictions["risk_multiplier"] = 1.15
                
                predictions["recommendations"].append({
                    "priority": "low",
                    "category": "Smoking",
                    "title": "Good progress! Risk is declining",
                    "message": f"After {years_since_quit:.0f} years smoke-free, your risk has reduced by 30-40%",
                    "timeline_projection": {
                        "5_more_years": "Risk will approach non-smoker levels"
                    },
                    "maintenance_tips": [
                        "Stay vigilant against relapse triggers",
                        "Celebrate your achievement"
                    ],
                    "research": "Akter et al., 2017"
                })
            else:  # <5 years
                if pack_years >= 20:
                    predictions["risk_category"] = "high"
                    predictions["risk_multiplier"] = 1.40
                else:
                    predictions["risk_category"] = "moderate_high"
                    predictions["risk_multiplier"] = 1.30
                
                predictions["risk_factors"].append({
                    "factor": "recent_quit",
                    "years_since_quit": years_since_quit,
                    "pack_years": pack_years,
                    "risk_increase": f"Still elevated ({int((predictions['risk_multiplier'] - 1) * 100)}%)",
                    "research": "Akter et al., 2017"
                })
                
                predictions["recommendations"].append({
                    "priority": "medium",
                    "category": "Smoking",
                    "title": "Great job quitting! Keep going",
                    "message": f"After {years_since_quit:.1f} years, your risk is declining but still elevated",
                    "timeline_projection": {
                        "5_years": "Risk will be significantly reduced",
                        "10_years": "Risk will approach non-smoker levels"
                    },
                    "maintenance_tips": [
                        "Stay vigilant against relapse triggers",
                        "Continue using cessation support if needed",
                        "Celebrate milestones (1 month, 6 months, 1 year)",
                        "Remember: each smoke-free day reduces risk"
                    ],
                    "research": "Akter et al., 2017"
                })
            
            predictions["timeline_predictions"] = {
                "continued_abstinence": {
                    "5_years": "Risk continues to decline",
                    "5_years_description": f"With {years_since_quit:.0f} years already smoke-free, continuing to {years_since_quit + 5:.0f} years will bring your diabetes risk down significantly through ongoing cellular repair and metabolic normalization.",
                    "10_years": "Approaches non-smoker risk",
                    "10_years_description": f"Reaching {years_since_quit + 10:.0f} total years smoke-free allows your body to fully recover metabolic function. Despite your {pack_years:.0f} pack-year history, diabetes risk approaches never-smoker levels.",
                    "research": "Akter et al., 2017"
                }
            }
        
        predictions["research_references"] = [
            "Willi et al., 2007: JAMA smoking meta-analysis",
            "Pan et al., 2015: Lancet dose-response study",
            "Akter et al., 2017: Quitting benefits study"
        ]
        
        return predictions
    
    # ==================== UNIFIED RECOMMENDATIONS ====================
    
    @staticmethod
    def get_healthy_defaults() -> Dict[str, Any]:
        """
        Returns healthy default recommendations when insufficient data is available.
        Based on established guidelines and research.
        """
        return {
            "message": "When tracking data is insufficient, follow these evidence-based guidelines",
            "guidelines": {
                "diet": {
                    "title": "Healthy Eating Guidelines",
                    "recommendations": [
                        "Eat 5+ servings of vegetables daily",
                        "Choose whole grains over refined grains",
                        "Limit added sugars to <25g daily (WHO)",
                        "Aim for 25-30g fiber daily",
                        "Include lean protein with every meal",
                        "Limit saturated fat to <20g daily"
                    ],
                    "research": "DPP Study, ADA Standards of Care 2024"
                },
                "sleep": {
                    "title": "Sleep Guidelines",
                    "recommendations": [
                        "Aim for 7-8 hours of sleep per night",
                        "Keep a consistent bedtime (±30 minutes)",
                        "Avoid screens 1 hour before bed",
                        "Keep bedroom cool (65-68°F/18-20°C)",
                        "Limit caffeine after 2 PM"
                    ],
                    "research": "American Academy of Sleep Medicine"
                },
                "activity": {
                    "title": "Physical Activity Guidelines",
                    "recommendations": [
                        "Aim for 7,000-10,000 steps daily",
                        "Take walking breaks every hour if sedentary",
                        "Include 150 minutes moderate activity weekly",
                        "Add strength training 2x per week"
                    ],
                    "research": "Physical Activity Guidelines Advisory Committee, 2018"
                },
                "alcohol": {
                    "title": "Alcohol Guidelines",
                    "recommendations": [
                        "If you drink, limit to ≤2 drinks/day (men) or ≤1 (women)",
                        "Have alcohol-free days each week",
                        "Avoid binge drinking episodes",
                        "Drink with meals rather than on empty stomach"
                    ],
                    "research": "NIAAA, CDC Guidelines"
                },
                "smoking": {
                    "title": "Smoking Guidelines",
                    "recommendations": [
                        "Don't smoke - if you do, quit",
                        "Seek help: nicotine replacement, counseling",
                        "Avoid secondhand smoke",
                        "Each smoke-free day reduces risk"
                    ],
                    "research": "CDC, ADA Guidelines"
                }
            }
        }
    
    @staticmethod
    def calculate_overall_lifestyle_risk(
        food_risk: Optional[Dict] = None,
        sleep_risk: Optional[Dict] = None,
        activity_risk: Optional[Dict] = None,
        alcohol_risk: Optional[Dict] = None,
        smoking_risk: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Calculates overall lifestyle-based diabetes risk.
        Combines all tracker data into a unified risk assessment.
        """
        trackers_with_data = []
        total_risk_modifier = 0
        risk_factors = []
        all_recommendations = []
        
        # Weight each tracker's contribution
        weights = {
            "food": 0.30,      # Diet is major factor
            "activity": 0.25,  # Physical activity
            "sleep": 0.20,     # Sleep patterns
            "smoking": 0.15,   # Smoking status
            "alcohol": 0.10    # Alcohol consumption
        }
        
        # Process food risk
        if food_risk and food_risk.get("risk_factors"):
            trackers_with_data.append("food")
            for factor in food_risk["risk_factors"]:
                risk_factors.append({**factor, "tracker": "food"})
            # Extract recommendations
            for rec in food_risk.get("recommendations", []):
                all_recommendations.append({**rec, "tracker": "food"})
        
        # Process sleep risk
        if sleep_risk and sleep_risk.get("risk_factors"):
            trackers_with_data.append("sleep")
            for factor in sleep_risk["risk_factors"]:
                risk_factors.append({**factor, "tracker": "sleep"})
            for rec in sleep_risk.get("recommendations", []):
                all_recommendations.append({**rec, "tracker": "sleep"})
        
        # Process activity risk
        if activity_risk and activity_risk.get("risk_factors"):
            trackers_with_data.append("activity")
            for factor in activity_risk["risk_factors"]:
                risk_factors.append({**factor, "tracker": "activity"})
            for rec in activity_risk.get("recommendations", []):
                all_recommendations.append({**rec, "tracker": "activity"})
        
        # Process alcohol risk
        if alcohol_risk and alcohol_risk.get("risk_factors"):
            trackers_with_data.append("alcohol")
            for factor in alcohol_risk["risk_factors"]:
                risk_factors.append({**factor, "tracker": "alcohol"})
            for rec in alcohol_risk.get("recommendations", []):
                all_recommendations.append({**rec, "tracker": "alcohol"})
        
        # Process smoking risk
        if smoking_risk and smoking_risk.get("risk_factors"):
            trackers_with_data.append("smoking")
            for factor in smoking_risk["risk_factors"]:
                risk_factors.append({**factor, "tracker": "smoking"})
            for rec in smoking_risk.get("recommendations", []):
                all_recommendations.append({**rec, "tracker": "smoking"})
        
        # Calculate weighted risk score
        if trackers_with_data:
            # Normalize weights based on available trackers
            available_weight_sum = sum(weights[t] for t in trackers_with_data)
            normalized_weights = {t: weights[t] / available_weight_sum for t in trackers_with_data}
        else:
            normalized_weights = {}
        
        # Sort recommendations by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        all_recommendations.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 3))
        
        # Get top priority actions
        priority_actions = []
        for rec in all_recommendations[:5]:  # Top 5 recommendations
            if rec.get("priority") in ["critical", "high"]:
                priority_actions.append({
                    "tracker": rec.get("tracker"),
                    "action": rec.get("title"),
                    "message": rec.get("message"),
                    "priority": rec.get("priority")
                })
        
        # Calculate overall risk category
        num_critical = sum(1 for r in all_recommendations if r.get("priority") == "critical")
        num_high = sum(1 for r in all_recommendations if r.get("priority") == "high")
        
        if num_critical >= 2 or (num_critical >= 1 and num_high >= 2):
            overall_category = "very_high"
            overall_score = 85
        elif num_critical >= 1 or num_high >= 3:
            overall_category = "high"
            overall_score = 65
        elif num_high >= 1:
            overall_category = "moderate"
            overall_score = 45
        else:
            overall_category = "low"
            overall_score = 25
        
        return {
            "overall_risk_score": overall_score,
            "overall_risk_category": overall_category,
            "trackers_analyzed": trackers_with_data,
            "trackers_missing": [t for t in weights.keys() if t not in trackers_with_data],
            "risk_factors": risk_factors,
            "priority_actions": priority_actions,
            "all_recommendations": all_recommendations,
            "healthy_defaults": LifestyleRecommendationService.get_healthy_defaults()
        }


# Singleton instance
_lifestyle_service = None

def get_lifestyle_recommendation_service() -> LifestyleRecommendationService:
    """Get singleton instance of LifestyleRecommendationService"""
    global _lifestyle_service
    if _lifestyle_service is None:
        _lifestyle_service = LifestyleRecommendationService()
    return _lifestyle_service
