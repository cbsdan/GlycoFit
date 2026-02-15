"""
Smoking Tracking Service for Prediabetes and Type 2 Diabetes Risk Assessment

This service provides:
- Rolling average computation (7-day and 30-day)
- Cigarette count variability calculation
- Risk categorization based on epidemiological research
- Self-correcting risk assessment over time

Risk Logic (study-based):
- Active smoking: Increases T2D risk by ~44% (Willi et al., 2007 JAMA)
- Pack-years: Dose-response relationship (Pan et al., 2015 Lancet)
- Heavy smoking (>20 cigs/day): >60% increased risk
- Former smokers: Risk decreases over time after quitting (Akter et al., 2017)
- Risk approaches baseline after 10+ years of quitting
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
import math
from statistics import mean, stdev

from models.smoking_tracking import (
    SmokingBaseline,
    SmokingDailyRecord,
    SmokingMetrics,
    SmokingRiskAssessment,
    SmokingStatus,
    SmokingRiskCategory
)


class SmokingTrackingService:
    """Service for smoking tracking and diabetes risk assessment"""
    
    # Risk thresholds based on epidemiological research
    LIGHT_SMOKING = 5  # cigarettes per day
    MODERATE_SMOKING = 10  # cigarettes per day
    HEAVY_SMOKING = 20  # cigarettes per day
    
    # Minimum data requirements
    MIN_DAYS_FOR_ROLLING_AVG = 3  # Minimum days needed for meaningful average
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    # ==================== BASELINE OPERATIONS ====================
    
    def create_baseline(
        self,
        user_id: str,
        smoking_status: str,
        years_smoked: float = 0,
        typical_cigarettes_per_day: int = 0,
        quit_date: str = None,
        start_smoking_age: int = None
    ) -> Dict[str, Any]:
        """
        Create manual baseline smoking input (required at onboarding).
        This can only be done once and cannot be overwritten.
        
        Args:
            user_id: User identifier
            smoking_status: never, former, or current
            years_smoked: Total years of smoking
            typical_cigarettes_per_day: Average cigarettes per day during smoking period
            quit_date: Date when user quit (YYYY-MM-DD)
            start_smoking_age: Age when started smoking
        
        Returns:
            Created baseline data or error
        """
        # Validate inputs
        if smoking_status not in [SmokingStatus.NEVER, SmokingStatus.FORMER, SmokingStatus.CURRENT]:
            raise ValueError("smoking_status must be 'never', 'former', or 'current'")
        
        if smoking_status != SmokingStatus.NEVER:
            if years_smoked < 0:
                raise ValueError("years_smoked must be non-negative")
            
            if typical_cigarettes_per_day < 0:
                raise ValueError("typical_cigarettes_per_day must be non-negative")
            
            if smoking_status == SmokingStatus.FORMER and not quit_date:
                raise ValueError("quit_date is required for former smokers")
        
        # Check if baseline already exists
        if SmokingBaseline.exists_for_user(user_id):
            raise ValueError("Baseline already exists for this user. Use update_baseline to modify.")
        
        # Create baseline
        baseline = SmokingBaseline(
            user_id=user_id,
            smoking_status=smoking_status,
            years_smoked=years_smoked if smoking_status != SmokingStatus.NEVER else 0,
            typical_cigarettes_per_day=typical_cigarettes_per_day if smoking_status != SmokingStatus.NEVER else 0,
            quit_date=quit_date,
            start_smoking_age=start_smoking_age,
            is_locked=True
        )
        
        baseline.save()
        
        # Compute initial metrics
        self.compute_metrics(user_id)
        
        self.logger.info(f"Smoking baseline created for user {user_id}")
        
        return baseline.to_dict()
    
    def get_baseline(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get baseline for user"""
        baseline = SmokingBaseline.find_by_user(user_id)
        return baseline.to_dict() if baseline else None
    
    def has_baseline(self, user_id: str) -> bool:
        """Check if user has baseline"""
        return SmokingBaseline.exists_for_user(user_id)
    
    def update_baseline(
        self,
        user_id: str,
        smoking_status: str,
        years_smoked: float = 0,
        typical_cigarettes_per_day: int = 0,
        quit_date: str = None,
        start_smoking_age: int = None
    ) -> Dict[str, Any]:
        """
        Update existing baseline (retake questionnaire).
        This unlocks, updates, and re-locks the baseline.
        """
        # Validate inputs
        if smoking_status not in [SmokingStatus.NEVER, SmokingStatus.FORMER, SmokingStatus.CURRENT]:
            raise ValueError("smoking_status must be 'never', 'former', or 'current'")
        
        # Check if baseline exists
        if not SmokingBaseline.exists_for_user(user_id):
            raise ValueError("No baseline exists for this user. Use create_baseline first.")
        
        # Delete existing baseline
        db = SmokingBaseline.find_by_user(user_id)
        if db:
            from config.database import get_db as get_database
            database = get_database()
            collection = database[SmokingBaseline.COLLECTION_NAME]
            collection.delete_one({"user_id": user_id})
        
        # Create new baseline
        baseline = SmokingBaseline(
            user_id=user_id,
            smoking_status=smoking_status,
            years_smoked=years_smoked if smoking_status != SmokingStatus.NEVER else 0,
            typical_cigarettes_per_day=typical_cigarettes_per_day if smoking_status != SmokingStatus.NEVER else 0,
            quit_date=quit_date,
            start_smoking_age=start_smoking_age,
            is_locked=True
        )
        
        baseline.save()
        
        # Recompute metrics
        self.compute_metrics(user_id)
        
        self.logger.info(f"Smoking baseline updated for user {user_id}")
        
        return baseline.to_dict()
    
    # ==================== DAILY RECORD OPERATIONS ====================
    
    def log_daily_smoking(
        self,
        user_id: str,
        date: str,
        cigarettes_count: int,
        notes: str = None
    ) -> Dict[str, Any]:
        """
        Log daily smoking record.
        
        Args:
            user_id: User identifier
            date: Date in YYYY-MM-DD format
            cigarettes_count: Number of cigarettes smoked
            notes: Optional notes
        
        Returns:
            Created/updated record data
        """
        # Validate inputs
        self._validate_date_format(date)
        
        if cigarettes_count < 0:
            raise ValueError("cigarettes_count must be non-negative")
        
        # Create/update record
        record = SmokingDailyRecord(
            user_id=user_id,
            date=date,
            cigarettes_count=cigarettes_count,
            notes=notes
        )
        
        record.save()
        
        # Recompute metrics
        self.compute_metrics(user_id)
        
        self.logger.info(f"Smoking record logged for user {user_id} on {date}")
        
        return record.to_dict()
    
    def get_daily_records(
        self,
        user_id: str,
        start_date: str = None,
        end_date: str = None,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get daily records for user.
        
        Args:
            user_id: User identifier
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            days: Number of days to fetch if no date range specified
        
        Returns:
            List of daily records
        """
        # If no date range specified, use last N days
        if not start_date and not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        records = SmokingDailyRecord.find_by_user(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return [record.to_dict() for record in records]
    
    def delete_daily_record(
        self,
        user_id: str,
        date: str
    ) -> Dict[str, Any]:
        """Delete daily record"""
        deleted_count = SmokingDailyRecord.delete_by_user_and_date(user_id, date)
        
        if deleted_count > 0:
            # Recompute metrics
            self.compute_metrics(user_id)
            self.logger.info(f"Smoking record deleted for user {user_id} on {date}")
        
        return {"deleted": deleted_count}
    
    # ==================== METRICS COMPUTATION ====================
    
    def compute_metrics(self, user_id: str) -> Dict[str, Any]:
        """
        Compute smoking metrics for user.
        
        Computes:
        - 7-day and 30-day average cigarettes per day
        - Cigarette count variability
        - Cumulative pack-years
        - Current status
        - Risk assessment
        
        IMPORTANT: This works even when user has NO daily records yet (baseline only).
        For baseline-only users, risk is assessed based on baseline smoking_status and history.
        """
        baseline = SmokingBaseline.find_by_user(user_id)
        
        if not baseline:
            raise ValueError("No baseline found for user. Create baseline first.")
        
        # Get daily records for last 30 days
        end_date = datetime.now()
        start_date_30d = end_date - timedelta(days=30)
        start_date_7d = end_date - timedelta(days=7)
        
        records_30d = SmokingDailyRecord.find_by_user(
            user_id=user_id,
            start_date=start_date_30d.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d")
        )
        
        # Filter for 7-day records
        records_7d = [r for r in records_30d if self._is_within_days(r.date, 7)]
        
        # Compute averages (None if insufficient data)
        avg_7d = None
        avg_30d = None
        variability_30d = None
        
        if len(records_7d) >= self.MIN_DAYS_FOR_ROLLING_AVG:
            cigarettes_7d = [r.cigarettes_count for r in records_7d]
            avg_7d = mean(cigarettes_7d)
        
        if len(records_30d) >= self.MIN_DAYS_FOR_ROLLING_AVG:
            cigarettes_30d = [r.cigarettes_count for r in records_30d]
            avg_30d = mean(cigarettes_30d)
            
            if len(cigarettes_30d) > 1:
                variability_30d = stdev(cigarettes_30d)
        
        # Calculate cumulative pack-years
        # Pack-years = (cigarettes per day / 20) * years smoked
        baseline_pack_years = (baseline.typical_cigarettes_per_day / 20) * baseline.years_smoked
        
        # Add pack-years from daily tracking (if current smoker with daily data)
        daily_pack_years = 0
        if baseline.smoking_status == SmokingStatus.CURRENT and avg_30d is not None:
            # Estimate additional pack-years from daily tracking
            # (This is approximate - assumes avg_30d represents recent smoking)
            days_tracked = len(records_30d)
            if days_tracked > 0:
                years_tracked = days_tracked / 365.25
                daily_pack_years = (avg_30d / 20) * years_tracked
        
        cumulative_pack_years = baseline_pack_years + daily_pack_years
        
        # Calculate years since quit
        years_since_quit = None
        if baseline.smoking_status == SmokingStatus.FORMER and baseline.quit_date:
            try:
                quit_date_obj = datetime.strptime(baseline.quit_date, "%Y-%m-%d")
                years_since_quit = (datetime.now() - quit_date_obj).days / 365.25
            except ValueError:
                self.logger.warning(f"Invalid quit_date format for user {user_id}")
        
        # Determine current status (may differ from baseline if daily data shows smoking)
        current_status = baseline.smoking_status
        
        # Override baseline status based on actual daily logs
        if avg_7d is not None and avg_7d > 0:
            # ANY smoking in last 7 days = current smoker (regardless of baseline)
            # This handles: never→current, former→current (relapse)
            current_status = SmokingStatus.CURRENT
        elif baseline.smoking_status == SmokingStatus.CURRENT and avg_30d is not None and avg_30d == 0:
            # Current smoker with no smoking in 30 days → may have quit
            current_status = SmokingStatus.FORMER
        
        # Compute risk assessment
        risk_data = self._compute_risk_assessment(
            smoking_status=current_status,
            avg_cigarettes_7d=avg_7d,
            avg_cigarettes_30d=avg_30d,
            cumulative_pack_years=cumulative_pack_years,
            years_since_quit=years_since_quit,
            baseline=baseline,
            days_with_data_7d=len(records_7d),
            days_with_data_30d=len(records_30d)
        )
        
        # Save metrics
        metrics = SmokingMetrics(
            user_id=user_id,
            avg_cigarettes_7d=avg_7d,
            avg_cigarettes_30d=avg_30d,
            cigarette_variability_30d=variability_30d,
            days_with_data_7d=len(records_7d),
            days_with_data_30d=len(records_30d),
            cumulative_pack_years=cumulative_pack_years,
            years_since_quit=years_since_quit,
            current_status=current_status,
            risk_category=risk_data["risk_category"],
            risk_factors=risk_data["risk_factors"],
            risk_score=risk_data["risk_score"]
        )
        
        metrics.save()
        
        # Save risk assessment
        risk_assessment = SmokingRiskAssessment(
            user_id=user_id,
            risk_category=risk_data["risk_category"],
            risk_score=risk_data["risk_score"],
            risk_factors=risk_data["risk_factors"],
            explanation=risk_data["explanation"],
            recommendations=risk_data["recommendations"]
        )
        
        risk_assessment.save()
        
        self.logger.info(f"Smoking metrics computed for user {user_id}")
        
        return metrics.to_dict()
    
    def get_metrics(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached metrics for user"""
        metrics = SmokingMetrics.find_by_user(user_id)
        return metrics.to_dict() if metrics else None
    
    # ==================== RISK ASSESSMENT ====================
    
    def _compute_risk_assessment(
        self,
        smoking_status: str,
        avg_cigarettes_7d: float,
        avg_cigarettes_30d: float,
        cumulative_pack_years: float,
        years_since_quit: float,
        baseline: SmokingBaseline,
        days_with_data_7d: int,
        days_with_data_30d: int
    ) -> Dict[str, Any]:
        """
        Compute diabetes risk based on smoking data.
        
        Evidence-based on medical research:
        - Willi et al. (2007) JAMA: Active smokers have 44% increased T2D risk
        - Pan et al. (2015) Lancet: Dose-response with pack-years
        - Akter et al. (2017): Risk reduction after quitting (5-10+ years)
        """
        risk_factors = []
        recommendations = []
        risk_score = 1  # Base risk
        
        # NEVER SMOKER
        if smoking_status == SmokingStatus.NEVER:
            return {
                "risk_category": SmokingRiskCategory.LOW,
                "risk_score": 1,
                "risk_factors": [],
                "explanation": "Never smoked - baseline diabetes risk. Maintain this healthy behavior.",
                "recommendations": [
                    "Continue avoiding tobacco products",
                    "Focus on other diabetes prevention strategies (diet, exercise, weight management)"
                ]
            }
        
        # CURRENT SMOKER
        elif smoking_status == SmokingStatus.CURRENT:
            risk_factors.append("Active smoking (44% increased diabetes risk)")
            
            # Determine current cigarette consumption
            # Priority: 30d avg > 7d avg > baseline typical
            if avg_cigarettes_30d is not None:
                current_cigs = avg_cigarettes_30d
            elif avg_cigarettes_7d is not None:
                current_cigs = avg_cigarettes_7d
            else:
                current_cigs = baseline.typical_cigarettes_per_day
            
            # Intensity-based risk (dose-response relationship)
            if current_cigs >= self.HEAVY_SMOKING:
                risk_score = 5
                risk_category = SmokingRiskCategory.VERY_HIGH
                risk_factors.append(f"Heavy smoking ({current_cigs:.1f} cigarettes/day)")
                explanation = f"Current heavy smoker ({current_cigs:.1f} cigs/day, {cumulative_pack_years:.1f} pack-years) - very high diabetes risk (>60% increase). Quitting is critical."
            elif current_cigs >= self.MODERATE_SMOKING:
                risk_score = 4
                risk_category = SmokingRiskCategory.HIGH
                risk_factors.append(f"Moderate smoking ({current_cigs:.1f} cigarettes/day)")
                explanation = f"Current moderate smoker ({current_cigs:.1f} cigs/day, {cumulative_pack_years:.1f} pack-years) - high diabetes risk (~50% increase)."
            elif current_cigs >= self.LIGHT_SMOKING:
                risk_score = 3
                risk_category = SmokingRiskCategory.MODERATE
                risk_factors.append(f"Light smoking ({current_cigs:.1f} cigarettes/day)")
                explanation = f"Current light smoker ({current_cigs:.1f} cigs/day, {cumulative_pack_years:.1f} pack-years) - moderate diabetes risk (~40% increase)."
            else:
                risk_score = 3
                risk_category = SmokingRiskCategory.MODERATE
                explanation = f"Current smoker ({cumulative_pack_years:.1f} pack-years) - moderate diabetes risk."
            
            # Additional pack-years risk
            if cumulative_pack_years >= 30:
                risk_factors.append(f"Very high cumulative exposure ({cumulative_pack_years:.1f} pack-years)")
            elif cumulative_pack_years >= 20:
                risk_factors.append(f"High cumulative exposure ({cumulative_pack_years:.1f} pack-years)")
            
            recommendations = [
                "Strongly consider quitting smoking - most effective way to reduce diabetes risk",
                "Consult with healthcare provider about smoking cessation programs",
                "Consider nicotine replacement therapy or prescription medications",
                "Set a quit date and make a quit plan",
                "Join support groups or use quit-smoking apps",
                "Monitor blood glucose regularly"
            ]
        
        # FORMER SMOKER
        elif smoking_status == SmokingStatus.FORMER:
            if years_since_quit is None:
                years_since_quit = 0
            
            # Risk decreases over time after quitting (Akter et al., 2017)
            if years_since_quit >= 10:
                # Risk approaches baseline after 10+ years
                if cumulative_pack_years >= 30:
                    risk_score = 2
                    risk_category = SmokingRiskCategory.MODERATE
                    risk_factors.append(f"Former heavy smoker (quit {years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years)")
                    explanation = f"Former smoker (quit {years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years) - risk approaching baseline but still slightly elevated due to past heavy smoking."
                else:
                    risk_score = 1.5
                    risk_category = SmokingRiskCategory.LOW
                    risk_factors.append(f"Former smoker (quit {years_since_quit:.1f} years ago)")
                    explanation = f"Former smoker (quit {years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years) - risk nearly at baseline. Great work!"
                
                recommendations = [
                    "Excellent progress! Maintain tobacco-free lifestyle",
                    "Continue healthy habits to prevent relapse",
                    "Regular health check-ups recommended"
                ]
            
            elif years_since_quit >= 5:
                # Significant risk reduction after 5-10 years
                if cumulative_pack_years >= 20:
                    risk_score = 3
                    risk_category = SmokingRiskCategory.MODERATE
                    risk_factors.append(f"Former smoker (quit {years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years)")
                    explanation = f"Former smoker (quit {years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years) - moderate risk, continuing to decrease."
                else:
                    risk_score = 2
                    risk_category = SmokingRiskCategory.LOW
                    risk_factors.append(f"Former smoker (quit {years_since_quit:.1f} years ago)")
                    explanation = f"Former smoker (quit {years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years) - low risk and improving."
                
                recommendations = [
                    "Great progress! Continue staying tobacco-free",
                    "Risk continues to decrease each year",
                    "Focus on other diabetes prevention strategies",
                    "Regular health monitoring recommended"
                ]
            
            else:
                # Recent quitter (< 5 years)
                if cumulative_pack_years >= 20:
                    risk_score = 4
                    risk_category = SmokingRiskCategory.HIGH
                    risk_factors.append(f"Recently quit smoker ({years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years)")
                    explanation = f"Recently quit smoker ({years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years) - risk still elevated but beginning to decrease."
                else:
                    risk_score = 3
                    risk_category = SmokingRiskCategory.MODERATE
                    risk_factors.append(f"Recently quit smoker ({years_since_quit:.1f} years ago)")
                    explanation = f"Recently quit smoker ({years_since_quit:.1f} years ago, {cumulative_pack_years:.1f} pack-years) - moderate risk, starting to improve."
                
                recommendations = [
                    "Congratulations on quitting! Stay committed",
                    "Avoid relapse - risk reduction benefits increase over time",
                    "Continue avoiding smoking triggers",
                    "Monitor blood glucose regularly",
                    "Consider smoking cessation support if experiencing cravings"
                ]
        
        return {
            "risk_category": risk_category,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "explanation": explanation,
            "recommendations": recommendations
        }
    
    def get_risk_assessment(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get latest risk assessment for user"""
        assessment = SmokingRiskAssessment.find_latest_by_user(user_id)
        return assessment.to_dict() if assessment else None
    
    def get_risk_history(self, user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        """Get risk assessment history for user"""
        assessments = SmokingRiskAssessment.find_history_by_user(user_id, limit)
        return [assessment.to_dict() for assessment in assessments]
    
    # ==================== HELPER METHODS ====================
    
    def _validate_date_format(self, date_str: str) -> None:
        """Validate date format (YYYY-MM-DD)"""
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD")
    
    def _is_within_days(self, date_str: str, days: int) -> bool:
        """Check if date is within last N days"""
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        days_ago = (datetime.now() - timedelta(days=days)).date()
        return date_obj >= days_ago
    
    # ==================== SUMMARY AND DASHBOARD ====================
    
    def get_smoking_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive smoking tracking summary for dashboard.
        
        Returns:
            - baseline
            - recent_records (last 7 days)
            - metrics
            - risk_assessment
        """
        baseline = self.get_baseline(user_id)
        
        if not baseline:
            return {
                "has_baseline": False,
                "baseline": None,
                "recent_records": [],
                "metrics": None,
                "risk_assessment": None
            }
        
        # Get recent records
        recent_records = self.get_daily_records(user_id, days=7)
        
        # Get metrics (compute if not exists)
        metrics = self.get_metrics(user_id)
        if not metrics:
            self.logger.info(f"Computing initial metrics for user {user_id}")
            metrics = self.compute_metrics(user_id)
        
        # Get risk assessment (should exist after metrics computation)
        risk_assessment = self.get_risk_assessment(user_id)
        
        # If somehow risk assessment is missing, force recompute
        if not risk_assessment:
            self.logger.warning(f"Risk assessment missing for user {user_id}, forcing recompute")
            metrics = self.compute_metrics(user_id)
            risk_assessment = self.get_risk_assessment(user_id)
        
        return {
            "has_baseline": True,
            "baseline": baseline,
            "recent_records": recent_records,
            "metrics": metrics,
            "risk_assessment": risk_assessment
        }


# Global service instance
smoking_tracking_service = SmokingTrackingService()


def get_smoking_tracking_service() -> SmokingTrackingService:
    """Get the smoking tracking service instance"""
    return smoking_tracking_service
