import logging
from pathlib import Path
from typing import Any, Dict, List

import joblib
import pandas as pd


logger = logging.getLogger(__name__)


class LifestyleMLService:
    """Service for lifestyle risk prediction using the GlycoFit XGBoost model."""

    def __init__(self):
        self.model = None
        self.feature_spec = None
        self.is_initialized = False

        self.risk_thresholds = {
            "low": (0.0, 0.33),
            "moderate": (0.33, 0.66),
            "high": (0.66, 1.0),
        }

    def initialize(self) -> bool:
        """Load model and feature specification files."""
        try:
            models_dir = Path(__file__).parent.parent / "models"
            model_path = models_dir / "glycofit_xgboost_model.pkl"
            features_path = models_dir / "glycofit_features.pkl"

            if not model_path.exists():
                logger.warning("Lifestyle model not found at %s", model_path)
                return False

            if not features_path.exists():
                logger.warning("Lifestyle feature specification not found at %s", features_path)
                return False

            self.model = joblib.load(model_path)
            self.feature_spec = joblib.load(features_path)

            self.is_initialized = True
            logger.info("Lifestyle ML service initialized successfully")
            return True
        except Exception as e:
            logger.error("Failed to initialize lifestyle ML service: %s", str(e), exc_info=True)
            return False

    @staticmethod
    def _normalize_key(key: str) -> str:
        return "".join(ch for ch in str(key).lower() if ch.isalnum())

    def _get_feature_order(self) -> List[str]:
        """Extract feature names from the feature spec PKL."""
        spec = self.feature_spec

        if spec is None:
            return []

        if isinstance(spec, list):
            return [str(x) for x in spec]
        if isinstance(spec, tuple):
            return [str(x) for x in spec]
        if isinstance(spec, set):
            return [str(x) for x in sorted(spec)]
        if isinstance(spec, dict):
            for candidate in ("feature_names", "features", "columns", "feature_order"):
                value = spec.get(candidate)
                if isinstance(value, (list, tuple, set)):
                    return [str(x) for x in value]
            # Fallback to dict keys if format is {feature: metadata}
            return [str(x) for x in spec.keys()]

        if hasattr(spec, "tolist"):
            try:
                return [str(x) for x in spec.tolist()]
            except Exception:
                pass

        return []

    def _flatten_inputs(self, tracker_inputs: Dict[str, Any]) -> Dict[str, float]:
        """Flatten food/activity/alcohol payloads into numeric candidate features."""
        flat: Dict[str, float] = {}

        food = tracker_inputs.get("food", {}) or {}
        activity = tracker_inputs.get("activity", {}) or {}
        alcohol = tracker_inputs.get("alcohol", {}) or {}
        profile = tracker_inputs.get("profile", {}) or {}

        def add_value(key: str, value: Any):
            try:
                flat[key] = float(value)
            except Exception:
                return

        for k, v in food.items():
            add_value(k, v)
        for k, v in activity.items():
            add_value(k, v)
        for k, v in alcohol.items():
            add_value(k, v)
        for k, v in profile.items():
            add_value(k, v)

        # Derived features commonly used in tabular training pipelines.
        age = flat.get("age")
        bmi = flat.get("bmi")
        calories = flat.get("calories") or flat.get("avg_calories")
        sugars = flat.get("added_sugars") or flat.get("avg_added_sugars")

        if age is not None and bmi is not None:
            flat.setdefault("bmi_age_interaction", float(bmi) * float(age))

        if calories and calories > 0 and sugars is not None:
            flat.setdefault("sugar_per_kcal", float(sugars) / float(calories))

        # Common aliases to improve compatibility with feature naming variants.
        aliases = {
            "glycemicload": ["glycemic_load", "avg_glycemic_load"],
            "fiber": ["fiber", "avg_fiber_grams", "avg_fiber"],
            "addedsugars": ["added_sugars", "avg_added_sugars"],
            "calories": ["calories", "avg_calories"],
            "avgdailysteps": ["avg_daily_steps", "avg_steps_30d", "avg_steps"],
            "daysgoalmet": ["days_goal_met", "days_met_goal_30d"],
            "drinksperweek": ["drinks_per_week", "avg_drinks_per_week_30d"],
            "bingeepisodes": ["binge_episodes_monthly", "binge_episodes_30d"],
            "ridageyr": ["age"],
            "bmxbmi": ["bmi"],
            "drxtkcal": ["calories", "avg_calories"],
            "drxtsugr": ["added_sugars", "avg_added_sugars"],
            "alq130": ["drinks_per_week", "avg_drinks_per_week_30d"],
            "paq605": ["activity_binary", "physically_active"],
            "bmiageinteraction": ["bmi_age_interaction"],
            "sugarperkcal": ["sugar_per_kcal"],
        }

        # Convert step volume to a binary physical activity signal often used in survey models.
        if "avg_daily_steps" in flat and "activity_binary" not in flat:
            flat["activity_binary"] = 1.0 if float(flat["avg_daily_steps"]) >= 7000 else 0.0
        if "avg_steps_30d" in flat and "activity_binary" not in flat:
            flat["activity_binary"] = 1.0 if float(flat["avg_steps_30d"]) >= 7000 else 0.0

        for canonical, keys in aliases.items():
            for k in keys:
                if k in flat:
                    flat.setdefault(canonical, flat[k])
                    break

        return flat

    def prepare_features(self, tracker_inputs: Dict[str, Any]) -> pd.DataFrame:
        """Prepare model input features as a one-row DataFrame."""
        feature_order = self._get_feature_order()
        if not feature_order:
            raise Exception("Feature specification is empty or unreadable")

        flat_inputs = self._flatten_inputs(tracker_inputs)
        normalized_flat = {self._normalize_key(k): v for k, v in flat_inputs.items()}

        feature_row: Dict[str, float] = {}
        for feature_name in feature_order:
            normalized_feature = self._normalize_key(feature_name)
            feature_row[feature_name] = float(normalized_flat.get(normalized_feature, 0.0))

        return pd.DataFrame([feature_row], columns=feature_order)

    def classify_risk(self, probability: float) -> str:
        if probability < self.risk_thresholds["moderate"][0]:
            return "low"
        if probability < self.risk_thresholds["high"][0]:
            return "moderate"
        return "high"

    def predict(self, tracker_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Predict lifestyle diabetes risk from food, activity, and alcohol inputs."""
        if not self.is_initialized:
            raise Exception("Lifestyle ML service not initialized")

        features = self.prepare_features(tracker_inputs)

        probabilities = self.model.predict_proba(features)[0]
        diabetes_probability = float(probabilities[1])
        risk_level = self.classify_risk(diabetes_probability)

        if risk_level == "low":
            distance = (self.risk_thresholds["moderate"][0] - diabetes_probability) / max(
                self.risk_thresholds["moderate"][0], 1e-6
            )
        elif risk_level == "moderate":
            low = self.risk_thresholds["moderate"][0]
            high = self.risk_thresholds["high"][0]
            midpoint = (low + high) / 2
            distance = 1 - (abs(diabetes_probability - midpoint) / max((high - low), 1e-6))
        else:
            distance = (diabetes_probability - self.risk_thresholds["high"][0]) / max(
                (1 - self.risk_thresholds["high"][0]), 1e-6
            )

        confidence = min(100.0, max(60.0, distance * 100.0))

        return {
            "risk_level": risk_level,
            "probability": diabetes_probability,
            "percentage": diabetes_probability * 100.0,
            "confidence": confidence,
            "model": "glycofit_xgboost_model.pkl",
            "trackers_used": ["food", "activity", "alcohol"],
            "trackers_excluded": ["sleep", "smoking"],
        }


_lifestyle_ml_service = None


def get_lifestyle_ml_service() -> LifestyleMLService:
    """Get or create singleton lifestyle ML service."""
    global _lifestyle_ml_service
    if _lifestyle_ml_service is None:
        _lifestyle_ml_service = LifestyleMLService()
        _lifestyle_ml_service.initialize()
    return _lifestyle_ml_service


def init_lifestyle_ml_service() -> bool:
    """Initialize the singleton lifestyle ML service."""
    global _lifestyle_ml_service
    _lifestyle_ml_service = LifestyleMLService()
    return _lifestyle_ml_service.initialize()