"""
Sleep Tracking Service for Prediabetes and Type 2 Diabetes Risk Assessment

This service provides:
- Rolling average computation (7-day and 30-day)
- Bedtime and sleep duration variability calculation
- Source weighting logic
- Risk categorization based on epidemiological research
- Self-correcting risk assessment over time

Risk Logic (study-based):
- Short sleep (<6h/night): Increases insulin resistance (+20-30 risk)
- Long sleep (>9h/night): Increases diabetes incidence (+15-25 risk)
- High variability in duration: Increases metabolic risk (+10-20 risk)
- High variability in bedtime: Increases metabolic risk (+10-15 risk)
- Optimal sleep: 7-8h/night with stable bedtime (baseline risk)

Source Weighting Logic:
- If no daily records → use baseline only
- If daily records exist → use rolling averages
- If Health Connect exists → prioritize Health Connect after 30 days
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import logging
import math
from statistics import mean, stdev

from models.sleep_tracking import (
    SleepBaseline,
    SleepDailyRecord,
    SleepMetrics,
    SleepRiskAssessment,
    SleepSource,
    DominantSleepSource,
    SleepRiskCategory
)


class SleepTrackingService:
    """Service for sleep tracking and diabetes risk assessment"""
    
    # Risk thresholds based on epidemiological research
    OPTIMAL_SLEEP_MIN = 7.0  # hours
    OPTIMAL_SLEEP_MAX = 8.0  # hours
    SHORT_SLEEP_THRESHOLD = 6.0  # hours - increased insulin resistance
    LONG_SLEEP_THRESHOLD = 9.0  # hours - increased diabetes incidence
    
    # Variability thresholds
    HIGH_SLEEP_VARIABILITY = 1.5  # hours standard deviation
    MODERATE_SLEEP_VARIABILITY = 1.0  # hours standard deviation
    HIGH_BEDTIME_VARIABILITY = 90  # minutes standard deviation
    MODERATE_BEDTIME_VARIABILITY = 60  # minutes standard deviation
    
    # Minimum data requirements
    MIN_DAYS_FOR_ROLLING_AVG = 3  # Minimum days needed for meaningful average
    HEALTH_CONNECT_PRIORITY_DAYS = 30  # Days before Health Connect takes priority
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    # ==================== BASELINE OPERATIONS ====================
    
    def create_baseline(
        self,
        user_id: str,
        baseline_avg_sleep_hours: float,
        baseline_nights_6h_plus_per_week: int,
        baseline_bedtime_consistency: int,
        usual_bedtime: str = None,
        usual_wake_time: str = None
    ) -> Dict[str, Any]:
        """
        Create manual baseline sleep input (required at onboarding).
        This can only be done once and cannot be overwritten.
        
        Args:
            user_id: User identifier
            baseline_avg_sleep_hours: Average hours of sleep per night
            baseline_nights_6h_plus_per_week: Nights with 6+ hours (0-7)
            baseline_bedtime_consistency: Self-reported consistency (1-5)
            usual_bedtime: Typical bedtime (HH:MM format)
            usual_wake_time: Typical wake time (HH:MM format)
        
        Returns:
            Created baseline data or error
        """
        # Validate inputs
        if not 0 <= baseline_avg_sleep_hours <= 24:
            raise ValueError("baseline_avg_sleep_hours must be between 0 and 24")
        
        if not 0 <= baseline_nights_6h_plus_per_week <= 7:
            raise ValueError("baseline_nights_6h_plus_per_week must be between 0 and 7")
        
        if not 1 <= baseline_bedtime_consistency <= 5:
            raise ValueError("baseline_bedtime_consistency must be between 1 and 5")
        
        # Check if baseline already exists
        if SleepBaseline.exists_for_user(user_id):
            raise ValueError("Sleep baseline already exists and cannot be modified")
        
        # Validate time formats if provided
        if usual_bedtime:
            self._validate_time_format(usual_bedtime)
        if usual_wake_time:
            self._validate_time_format(usual_wake_time)
        
        # Create baseline
        baseline = SleepBaseline(
            user_id=user_id,
            baseline_avg_sleep_hours=baseline_avg_sleep_hours,
            baseline_nights_6h_plus_per_week=baseline_nights_6h_plus_per_week,
            baseline_bedtime_consistency=baseline_bedtime_consistency,
            usual_bedtime=usual_bedtime,
            usual_wake_time=usual_wake_time
        )
        baseline.save()
        
        # Compute initial metrics and risk assessment
        self.compute_metrics(user_id)
        
        self.logger.info(f"Created sleep baseline for user {user_id}")
        return baseline.to_dict()
    
    def get_baseline(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's sleep baseline"""
        baseline = SleepBaseline.find_by_user_id(user_id)
        if baseline:
            return baseline.to_dict()
        return None
    
    def has_baseline(self, user_id: str) -> bool:
        """Check if user has completed baseline"""
        return SleepBaseline.exists_for_user(user_id)
    
    def update_baseline(
        self,
        user_id: str,
        baseline_avg_sleep_hours: float,
        baseline_nights_6h_plus_per_week: int,
        baseline_bedtime_consistency: int,
        usual_bedtime: str = None,
        usual_wake_time: str = None
    ) -> Dict[str, Any]:
        """
        Update existing baseline sleep input.
        Allows users to retake their baseline questionnaire.
        
        Args:
            user_id: User identifier
            baseline_avg_sleep_hours: Average hours of sleep per night
            baseline_nights_6h_plus_per_week: Nights with 6+ hours (0-7)
            baseline_bedtime_consistency: Self-reported consistency (1-5)
            usual_bedtime: Typical bedtime (HH:MM format)
            usual_wake_time: Typical wake time (HH:MM format)
        
        Returns:
            Updated baseline data or error
        """
        # Validate inputs
        if not 0 <= baseline_avg_sleep_hours <= 24:
            raise ValueError("baseline_avg_sleep_hours must be between 0 and 24")
        
        if not 0 <= baseline_nights_6h_plus_per_week <= 7:
            raise ValueError("baseline_nights_6h_plus_per_week must be between 0 and 7")
        
        if not 1 <= baseline_bedtime_consistency <= 5:
            raise ValueError("baseline_bedtime_consistency must be between 1 and 5")
        
        # Validate time formats if provided
        if usual_bedtime:
            self._validate_time_format(usual_bedtime)
        if usual_wake_time:
            self._validate_time_format(usual_wake_time)
        
        # Check if baseline exists
        baseline = SleepBaseline.find_by_user_id(user_id)
        if not baseline:
            raise ValueError("No baseline exists to update. Please create one first.")
        
        # Update baseline fields
        baseline.baseline_avg_sleep_hours = baseline_avg_sleep_hours
        baseline.baseline_nights_6h_plus_per_week = baseline_nights_6h_plus_per_week
        baseline.baseline_bedtime_consistency = baseline_bedtime_consistency
        baseline.usual_bedtime = usual_bedtime
        baseline.usual_wake_time = usual_wake_time
        baseline.save()
        
        # Recompute metrics and risk assessment with new baseline
        self.compute_metrics(user_id)
        
        self.logger.info(f"Updated sleep baseline for user {user_id}")
        return baseline.to_dict()
    
    # ==================== DAILY RECORD OPERATIONS ====================
    
    def log_manual_sleep(
        self,
        user_id: str,
        date: str,
        bedtime: str,
        sleep_duration_hours: float,
        wake_time: str = None,
        sleep_quality: int = None,
        notes: str = None
    ) -> Dict[str, Any]:
        """
        Log manual daily sleep record.
        
        Args:
            user_id: User identifier
            date: Date of sleep (YYYY-MM-DD)
            bedtime: Time user went to bed (HH:MM)
            sleep_duration_hours: Total sleep duration in hours
            wake_time: Optional wake time (HH:MM)
            sleep_quality: Optional quality rating (1-5)
            notes: Optional user notes
        
        Returns:
            Created/updated record data
        """
        # Validate inputs
        self._validate_date_format(date)
        self._validate_time_format(bedtime)
        
        if wake_time:
            self._validate_time_format(wake_time)
        else:
            # Derive wake_time from bedtime and duration
            wake_time = self._derive_wake_time(bedtime, sleep_duration_hours)
        
        if not 0 <= sleep_duration_hours <= 24:
            raise ValueError("sleep_duration_hours must be between 0 and 24")
        
        if sleep_quality is not None and not 1 <= sleep_quality <= 5:
            raise ValueError("sleep_quality must be between 1 and 5")
        
        # Create record
        record = SleepDailyRecord(
            user_id=user_id,
            date=date,
            bedtime=bedtime,
            wake_time=wake_time,
            sleep_duration_hours=sleep_duration_hours,
            source=SleepSource.MANUAL.value,
            sleep_quality=sleep_quality,
            notes=notes
        )
        record.save()
        
        # Recompute metrics
        self.compute_metrics(user_id)
        
        self.logger.info(f"Logged manual sleep for user {user_id} on {date}")
        return record.to_dict()
    
    def sync_health_connect_sleep(
        self,
        user_id: str,
        records: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Sync sleep data from Health Connect.
        
        Args:
            user_id: User identifier
            records: List of sleep records from Health Connect
                Each record should have: date, bedtime, wake_time, sleep_duration_hours
        
        Returns:
            Sync summary with counts
        """
        synced_count = 0
        skipped_count = 0
        errors = []
        
        for record_data in records:
            try:
                date = record_data.get("date")
                bedtime = record_data.get("bedtime")
                wake_time = record_data.get("wake_time")
                sleep_duration_hours = record_data.get("sleep_duration_hours")
                
                # Validate required fields
                if not all([date, bedtime, sleep_duration_hours]):
                    skipped_count += 1
                    continue
                
                self._validate_date_format(date)
                self._validate_time_format(bedtime)
                
                if wake_time:
                    self._validate_time_format(wake_time)
                else:
                    wake_time = self._derive_wake_time(bedtime, sleep_duration_hours)
                
                # Create/update record
                record = SleepDailyRecord(
                    user_id=user_id,
                    date=date,
                    bedtime=bedtime,
                    wake_time=wake_time,
                    sleep_duration_hours=float(sleep_duration_hours),
                    source=SleepSource.HEALTH_CONNECT.value
                )
                record.save()
                synced_count += 1
                
            except Exception as e:
                errors.append({"record": record_data, "error": str(e)})
                self.logger.error(f"Error syncing Health Connect record: {e}")
        
        # Recompute metrics after sync
        if synced_count > 0:
            self.compute_metrics(user_id)
        
        self.logger.info(f"Health Connect sync for user {user_id}: {synced_count} synced, {skipped_count} skipped")
        
        return {
            "synced": synced_count,
            "skipped": skipped_count,
            "errors": errors if errors else None,
            "message": f"Successfully synced {synced_count} sleep records"
        }
    
    def get_daily_records(
        self,
        user_id: str,
        start_date: str = None,
        end_date: str = None,
        days: int = 30,
        source: str = None
    ) -> List[Dict[str, Any]]:
        """
        Get daily sleep records for a user.
        
        Args:
            user_id: User identifier
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            days: Number of days to fetch if no date range specified
            source: Filter by source (manual, health_connect)
        
        Returns:
            List of sleep records
        """
        if start_date and end_date:
            records = SleepDailyRecord.find_by_user_and_date_range(
                user_id, start_date, end_date, source
            )
        else:
            records = SleepDailyRecord.find_recent_by_user(user_id, days)
            if source:
                records = [r for r in records if r.source == source]
        
        return [r.to_dict() for r in records]
    
    def delete_daily_record(
        self,
        user_id: str,
        date: str,
        source: str = None
    ) -> Dict[str, Any]:
        """Delete daily sleep record(s)"""
        count = SleepDailyRecord.delete_by_user_and_date(user_id, date, source)
        
        # Recompute metrics
        self.compute_metrics(user_id)
        
        return {"deleted": count, "message": f"Deleted {count} record(s)"}
    
    # ==================== METRICS COMPUTATION ====================
    
    def compute_metrics(self, user_id: str) -> Dict[str, Any]:
        """
        Compute rolling averages and variability metrics.
        
        This implements the source weighting logic:
        - If no daily records → use baseline only
        - If daily records exist → use rolling averages
        - If Health Connect exists → prioritize Health Connect after 30 days
        
        Returns:
            Computed metrics
        """
        baseline = SleepBaseline.find_by_user_id(user_id)
        
        # Get records for last 30 days
        records_30d = SleepDailyRecord.find_recent_by_user(user_id, 30)
        records_7d = [r for r in records_30d 
                      if self._is_within_days(r.date, 7)]
        
        # Count records by source
        source_counts = SleepDailyRecord.count_by_source(user_id, 30)
        manual_count = source_counts.get(SleepSource.MANUAL.value, 0)
        hc_count = source_counts.get(SleepSource.HEALTH_CONNECT.value, 0)
        
        # Determine dominant source
        dominant_source = self._determine_dominant_source(
            manual_count, hc_count, len(records_30d)
        )
        
        # Apply source weighting - prioritize Health Connect if enough data
        weighted_records_30d = self._apply_source_weighting(records_30d, hc_count)
        weighted_records_7d = [r for r in weighted_records_30d 
                               if self._is_within_days(r.date, 7)]
        
        # Compute averages
        avg_sleep_7d = None
        avg_sleep_30d = None
        
        if len(weighted_records_7d) >= self.MIN_DAYS_FOR_ROLLING_AVG:
            avg_sleep_7d = mean([r.sleep_duration_hours for r in weighted_records_7d])
        elif baseline:
            # Fall back to baseline
            avg_sleep_7d = baseline.baseline_avg_sleep_hours
        
        if len(weighted_records_30d) >= self.MIN_DAYS_FOR_ROLLING_AVG:
            avg_sleep_30d = mean([r.sleep_duration_hours for r in weighted_records_30d])
        elif baseline:
            avg_sleep_30d = baseline.baseline_avg_sleep_hours
        
        # Compute bedtime metrics
        bedtime_mean_30d = None
        bedtime_variability_30d = None
        sleep_variability_30d = None
        
        if len(weighted_records_30d) >= self.MIN_DAYS_FOR_ROLLING_AVG:
            # Convert bedtimes to minutes since midnight for calculation
            bedtime_minutes = [self._time_to_minutes(r.bedtime) for r in weighted_records_30d]
            bedtime_mean_30d = self._minutes_to_time(int(mean(bedtime_minutes)))
            
            if len(weighted_records_30d) >= 2:
                bedtime_variability_30d = stdev(bedtime_minutes)
                sleep_variability_30d = stdev([r.sleep_duration_hours for r in weighted_records_30d])
        elif baseline and baseline.usual_bedtime:
            bedtime_mean_30d = baseline.usual_bedtime
            # Estimate variability from consistency score (1-5)
            if baseline.baseline_bedtime_consistency:
                # Higher consistency = lower variability
                bedtime_variability_30d = (6 - baseline.baseline_bedtime_consistency) * 20
                sleep_variability_30d = (6 - baseline.baseline_bedtime_consistency) * 0.3
        
        # Count days with actual data
        days_with_data_7d = len(set(r.date for r in records_7d))
        days_with_data_30d = len(set(r.date for r in records_30d))
        
        # Compute risk assessment
        risk_result = self._compute_risk_assessment(
            avg_sleep_7d=avg_sleep_7d,
            avg_sleep_30d=avg_sleep_30d,
            sleep_variability=sleep_variability_30d,
            bedtime_variability=bedtime_variability_30d,
            baseline=baseline,
            days_with_data=days_with_data_30d
        )
        
        # Create metrics object
        metrics = SleepMetrics(
            user_id=user_id,
            avg_sleep_7d=round(avg_sleep_7d, 2) if avg_sleep_7d else None,
            avg_sleep_30d=round(avg_sleep_30d, 2) if avg_sleep_30d else None,
            bedtime_mean_30d=bedtime_mean_30d,
            bedtime_variability_30d=round(bedtime_variability_30d, 1) if bedtime_variability_30d else None,
            sleep_variability_30d=round(sleep_variability_30d, 2) if sleep_variability_30d else None,
            dominant_sleep_source=dominant_source,
            days_with_data_7d=days_with_data_7d,
            days_with_data_30d=days_with_data_30d,
            risk_category=risk_result["category"],
            risk_factors=risk_result["factors"],
            risk_score=risk_result["score"]
        )
        metrics.save()
        
        # Save risk assessment history
        assessment = SleepRiskAssessment(
            user_id=user_id,
            assessment_date=datetime.utcnow().strftime("%Y-%m-%d"),
            risk_category=risk_result["category"],
            risk_score=risk_result["score"],
            risk_factors=risk_result["factors"],
            recommendations=risk_result["recommendations"],
            data_quality=self._assess_data_quality(days_with_data_30d, dominant_source),
            metrics_snapshot=metrics.to_dict()
        )
        assessment.save()
        
        self.logger.info(f"Computed metrics for user {user_id}: risk={risk_result['category']}")
        return metrics.to_dict()
    
    def get_metrics(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current sleep metrics for a user"""
        metrics = SleepMetrics.find_by_user_id(user_id)
        if metrics:
            return metrics.to_dict()
        return None
    
    # ==================== RISK ASSESSMENT ====================
    
    def _compute_risk_assessment(
        self,
        avg_sleep_7d: float,
        avg_sleep_30d: float,
        sleep_variability: float,
        bedtime_variability: float,
        baseline: SleepBaseline,
        days_with_data: int
    ) -> Dict[str, Any]:
        """
        Compute diabetes risk based on sleep patterns.
        
        Risk scoring (0-100):
        - 0-25: LOW risk
        - 26-50: MODERATE risk
        - 51-75: HIGH risk
        - 76-100: VERY_HIGH risk
        
        Data Confidence Model (research-based):
        - <7 days: Preliminary assessment (heavily weighted toward baseline)
        - 7-13 days: Emerging pattern (50/50 baseline + actual data)
        - 14-29 days: Reliable assessment (75% actual data, 25% baseline)
        - 30+ days: High confidence (90% actual data, 10% baseline)
        
        Risk factors:
        - Short sleep (<6h): +25 points
        - Very short sleep (<5h): +40 points
        - Long sleep (>9h): +20 points
        - High sleep variability: +15 points (only with 14+ days)
        - High bedtime variability: +10 points (only with 14+ days)
        - Inconsistent baseline: +10 points
        - Low nights with adequate sleep: +15 points
        """
        risk_score = 0
        actual_risk_score = 0  # NEW: Unweighted risk based on actual data only
        risk_factors = []
        actual_risk_factors = []  # NEW: Risk factors from actual data
        recommendations = []
        
        # Calculate data confidence weight based on days tracked
        # Research shows reliable sleep patterns need 7-14 days minimum
        if days_with_data >= 30:
            data_weight = 0.90
            confidence_level = "high"
        elif days_with_data >= 14:
            data_weight = 0.75
            confidence_level = "good"
        elif days_with_data >= 7:
            data_weight = 0.50
            confidence_level = "moderate"
        else:
            data_weight = 0.30  # Heavily rely on baseline for <7 days
            confidence_level = "preliminary"
        
        baseline_weight = 1.0 - data_weight
        
        # Use 30-day average if available, otherwise 7-day
        avg_sleep = avg_sleep_30d if avg_sleep_30d else avg_sleep_7d
        
        # Weighted average between actual data and baseline
        # This prevents wild swings with limited data
        if avg_sleep is not None and baseline and baseline.baseline_avg_sleep_hours:
            weighted_avg_sleep = (
                avg_sleep * data_weight + 
                baseline.baseline_avg_sleep_hours * baseline_weight
            )
        elif avg_sleep is not None:
            weighted_avg_sleep = avg_sleep
        elif baseline:
            weighted_avg_sleep = baseline.baseline_avg_sleep_hours
        else:
            weighted_avg_sleep = None
        
        if weighted_avg_sleep is not None:
            # Short sleep risk (WEIGHTED)
            if weighted_avg_sleep < 5:
                risk_score += 40 * data_weight + 30 * baseline_weight  # Scale by confidence
                risk_factors.append("very_short_sleep")
                recommendations.append(
                    "Your average sleep is critically low. Aim for at least 7 hours per night "
                    "to reduce insulin resistance risk."
                )
            elif weighted_avg_sleep < self.SHORT_SLEEP_THRESHOLD:
                risk_score += 25 * data_weight + 20 * baseline_weight  # Scale by confidence
                risk_factors.append("short_sleep")
                recommendations.append(
                    "Getting less than 6 hours of sleep increases insulin resistance. "
                    "Try to gradually increase your sleep duration."
                )
            
            # Long sleep risk (WEIGHTED)
            elif weighted_avg_sleep > self.LONG_SLEEP_THRESHOLD:
                risk_score += 20 * data_weight + 15 * baseline_weight  # Scale by confidence
                risk_factors.append("long_sleep")
                recommendations.append(
                    "Sleeping more than 9 hours may indicate underlying health issues. "
                    "Consider consulting your healthcare provider."
                )
            
            # Optimal sleep bonus (reduce risk if in optimal range)
            elif self.OPTIMAL_SLEEP_MIN <= weighted_avg_sleep <= self.OPTIMAL_SLEEP_MAX:
                risk_score -= 5  # Small bonus for optimal sleep
                recommendations.append(
                    "Great! Your sleep duration is in the optimal range of 7-8 hours."
                )
        
        # NEW: Calculate ACTUAL risk score based on tracked data only (no weighting)
        # This provides early warning even when confidence is low
        if avg_sleep is not None:
            if avg_sleep < 5:
                actual_risk_score += 40
                if "very_short_sleep" not in actual_risk_factors:
                    actual_risk_factors.append("very_short_sleep")
            elif avg_sleep < self.SHORT_SLEEP_THRESHOLD:
                actual_risk_score += 25
                if "short_sleep" not in actual_risk_factors:
                    actual_risk_factors.append("short_sleep")
            elif avg_sleep > self.LONG_SLEEP_THRESHOLD:
                actual_risk_score += 20
                if "long_sleep" not in actual_risk_factors:
                    actual_risk_factors.append("long_sleep")
            elif self.OPTIMAL_SLEEP_MIN <= avg_sleep <= self.OPTIMAL_SLEEP_MAX:
                actual_risk_score -= 5

        
        # Sleep duration variability risk
        # Only apply if we have enough data for reliable variability (14+ days per research)
        if sleep_variability is not None and days_with_data >= 14:
            if sleep_variability >= self.HIGH_SLEEP_VARIABILITY:
                risk_score += 15 * data_weight
                risk_factors.append("high_sleep_variability")
                recommendations.append(
                    "Your sleep duration varies significantly. Try to maintain consistent "
                    "sleep duration for better metabolic health."
                )
            elif sleep_variability >= self.MODERATE_SLEEP_VARIABILITY:
                risk_score += 8 * data_weight
                risk_factors.append("moderate_sleep_variability")
        elif sleep_variability is not None and days_with_data < 14:
            # Note variability but don't heavily penalize with limited data
            if sleep_variability >= self.HIGH_SLEEP_VARIABILITY:
                risk_factors.append("early_variability_detected")
        
        # Bedtime variability risk
        # Only apply if we have enough data (14+ days)
        if bedtime_variability is not None and days_with_data >= 14:
            if bedtime_variability >= self.HIGH_BEDTIME_VARIABILITY:
                risk_score += 10 * data_weight
                risk_factors.append("high_bedtime_variability")
                recommendations.append(
                    "Your bedtime varies by more than 1.5 hours. Establishing a consistent "
                    "sleep schedule can improve metabolic health."
                )
            elif bedtime_variability >= self.MODERATE_BEDTIME_VARIABILITY:
                risk_score += 5 * data_weight
                risk_factors.append("moderate_bedtime_variability")
        
        # Baseline factors (always apply since these are self-reported patterns)
        if baseline:
            # Low nights with adequate sleep
            if baseline.baseline_nights_6h_plus_per_week < 5:
                risk_score += 15 * baseline_weight  # More weight when less data
                risk_factors.append("insufficient_adequate_nights")
                recommendations.append(
                    "You reported getting adequate sleep (6+ hours) on fewer than 5 nights "
                    "per week. Try to increase this."
                )
            
            # Poor consistency reported
            if baseline.baseline_bedtime_consistency <= 2:
                risk_score += 10 * baseline_weight
                risk_factors.append("poor_baseline_consistency")
        
        # Data quality adjustment
        data_quality_note = None
        early_warning = None
        
        if days_with_data < 7:
            data_quality_note = "insufficient_data"
            
            # Add early warning if actual risk differs significantly from weighted
            if abs(actual_risk_score - risk_score) > 15:
                early_warning = (
                    f"⚠️ Early Warning: Your recent sleep data shows higher risk patterns "
                    f"(actual risk: {round(actual_risk_score)}). Continue tracking to confirm trends."
                )
                
            recommendations.insert(0, 
                f"⚠️ Assessment based on only {days_with_data} day(s). "
                "Track for at least 7 days for reliable risk assessment. "
                "Current score is heavily weighted toward your baseline responses."
            )
        elif days_with_data < 14:
            data_quality_note = "limited_data"
            
            # Add early warning if actual risk differs significantly
            if abs(actual_risk_score - risk_score) > 15:
                early_warning = (
                    f"⚠️ Early Warning: Your tracked data suggests higher risk "
                    f"(actual risk: {round(actual_risk_score)}). Track for 14+ days for full assessment."
                )
                
            recommendations.insert(0,
                f"Assessment based on {days_with_data} days. "
                "Track for 14+ days for more accurate variability assessment."
            )
        
        # Ensure scores are within bounds
        risk_score = max(0, min(100, risk_score))
        actual_risk_score = max(0, min(100, actual_risk_score))
        
        # Determine category (based on weighted score)
        if risk_score <= 25:
            category = SleepRiskCategory.LOW.value
        elif risk_score <= 50:
            category = SleepRiskCategory.MODERATE.value
        elif risk_score <= 75:
            category = SleepRiskCategory.HIGH.value
        else:
            category = SleepRiskCategory.VERY_HIGH.value
        
        # Determine actual category
        if actual_risk_score <= 25:
            actual_category = SleepRiskCategory.LOW.value
        elif actual_risk_score <= 50:
            actual_category = SleepRiskCategory.MODERATE.value
        elif actual_risk_score <= 75:
            actual_category = SleepRiskCategory.HIGH.value
        else:
            actual_category = SleepRiskCategory.VERY_HIGH.value
        
        # Add general recommendations if none specific
        if not recommendations:
            recommendations.append(
                "Continue maintaining your current sleep patterns. "
                "Regular tracking helps identify trends over time."
            )
        
        return {
            "score": round(risk_score, 1),
            "category": category,
            "factors": risk_factors,
            "recommendations": recommendations,
            "data_quality": data_quality_note,
            "confidence_level": confidence_level,
            "days_tracked": days_with_data,
            # NEW: Actual risk based on tracked data only
            "actual_risk_score": round(actual_risk_score, 1),
            "actual_risk_category": actual_category,
            "actual_risk_factors": actual_risk_factors,
            "early_warning": early_warning
        }
    
    def get_risk_assessment(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get latest risk assessment for a user"""
        assessment = SleepRiskAssessment.find_latest_by_user(user_id)
        if assessment:
            return assessment.to_dict()
        return None
    
    def get_risk_history(self, user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        """Get risk assessment history for a user"""
        assessments = SleepRiskAssessment.find_history_by_user(user_id, limit)
        return [a.to_dict() for a in assessments]
    
    # ==================== HELPER METHODS ====================
    
    def _validate_date_format(self, date_str: str) -> None:
        """Validate date format (YYYY-MM-DD)"""
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD")
    
    def _validate_time_format(self, time_str: str) -> None:
        """Validate time format (HH:MM)"""
        try:
            parts = time_str.split(":")
            if len(parts) != 2:
                raise ValueError()
            hour, minute = int(parts[0]), int(parts[1])
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                raise ValueError()
        except (ValueError, AttributeError):
            raise ValueError(f"Invalid time format: {time_str}. Expected HH:MM (24-hour)")
    
    def _time_to_minutes(self, time_str: str) -> int:
        """Convert time string (HH:MM) to minutes since midnight"""
        parts = time_str.split(":")
        hour, minute = int(parts[0]), int(parts[1])
        minutes = hour * 60 + minute
        
        # Adjust for late night/early morning (bedtime after midnight)
        # If time is between 00:00 and 06:00, consider it as "previous day late night"
        if hour < 6:
            minutes += 24 * 60  # Add 24 hours
        
        return minutes
    
    def _minutes_to_time(self, minutes: int) -> str:
        """Convert minutes since midnight to time string (HH:MM)"""
        # Handle wrap-around for late night bedtimes
        minutes = minutes % (24 * 60)
        hour = minutes // 60
        minute = minutes % 60
        return f"{hour:02d}:{minute:02d}"
    
    def _derive_wake_time(self, bedtime: str, duration_hours: float) -> str:
        """Derive wake time from bedtime and sleep duration"""
        parts = bedtime.split(":")
        bed_hour, bed_minute = int(parts[0]), int(parts[1])
        
        total_minutes = bed_hour * 60 + bed_minute + int(duration_hours * 60)
        wake_hour = (total_minutes // 60) % 24
        wake_minute = total_minutes % 60
        
        return f"{wake_hour:02d}:{wake_minute:02d}"
    
    def _is_within_days(self, date_str: str, days: int) -> bool:
        """Check if date is within the last N days"""
        date = datetime.strptime(date_str, "%Y-%m-%d")
        cutoff = datetime.utcnow() - timedelta(days=days)
        return date >= cutoff
    
    def _determine_dominant_source(
        self,
        manual_count: int,
        health_connect_count: int,
        total_count: int
    ) -> str:
        """Determine the dominant data source"""
        if total_count == 0:
            return DominantSleepSource.MANUAL_ONLY.value  # Will use baseline
        
        if health_connect_count == 0:
            return DominantSleepSource.MANUAL_ONLY.value
        
        if manual_count == 0:
            return DominantSleepSource.HEALTH_CONNECT.value
        
        # If Health Connect has more than 60% of records, it's dominant
        if health_connect_count / total_count > 0.6:
            return DominantSleepSource.HEALTH_CONNECT.value
        
        return DominantSleepSource.MIXED.value
    
    def _apply_source_weighting(
        self,
        records: List[SleepDailyRecord],
        health_connect_count: int
    ) -> List[SleepDailyRecord]:
        """
        Apply source weighting logic.
        
        If Health Connect has >= 30 days of data, prioritize it by:
        - Using Health Connect data when both sources exist for same date
        - Otherwise use whatever is available
        """
        if health_connect_count < self.HEALTH_CONNECT_PRIORITY_DAYS:
            # Not enough Health Connect data, use all records
            # But prefer Health Connect for duplicates on same date
            pass
        
        # Group records by date
        by_date: Dict[str, List[SleepDailyRecord]] = {}
        for record in records:
            if record.date not in by_date:
                by_date[record.date] = []
            by_date[record.date].append(record)
        
        # Select best record for each date
        weighted_records = []
        for date, date_records in by_date.items():
            if len(date_records) == 1:
                weighted_records.append(date_records[0])
            else:
                # Prefer Health Connect if available
                hc_record = next(
                    (r for r in date_records if r.source == SleepSource.HEALTH_CONNECT.value),
                    None
                )
                if hc_record:
                    weighted_records.append(hc_record)
                else:
                    weighted_records.append(date_records[0])
        
        return weighted_records
    
    def _assess_data_quality(self, days_with_data: int, dominant_source: str) -> str:
        """Assess quality of sleep data"""
        if days_with_data >= 21:
            if dominant_source == DominantSleepSource.HEALTH_CONNECT.value:
                return "excellent"
            return "good"
        elif days_with_data >= 14:
            return "good"
        elif days_with_data >= 7:
            return "fair"
        elif days_with_data >= 3:
            return "limited"
        else:
            return "baseline_only"
    
    # ==================== SUMMARY AND DASHBOARD ====================
    
    def get_sleep_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive sleep summary for user dashboard.
        
        Returns:
            Complete sleep status including baseline, metrics, and risk assessment
        """
        baseline = self.get_baseline(user_id)
        metrics = self.get_metrics(user_id)
        risk = self.get_risk_assessment(user_id)
        
        # Get recent records for trend
        records = self.get_daily_records(user_id, days=7)
        
        # Determine status
        has_baseline = baseline is not None
        has_daily_data = len(records) > 0
        
        return {
            "status": {
                "has_baseline": has_baseline,
                "has_daily_data": has_daily_data,
                "days_tracked_last_week": len(records),
                "onboarding_complete": has_baseline
            },
            "baseline": baseline,
            "metrics": metrics,
            "risk_assessment": risk,
            "recent_records": records[:7],  # Last 7 entries
            "recommendations": risk.get("recommendations", []) if risk else []
        }


# Global service instance
sleep_tracking_service = SleepTrackingService()


def get_sleep_tracking_service() -> SleepTrackingService:
    """Get the sleep tracking service instance"""
    return sleep_tracking_service
