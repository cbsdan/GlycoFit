import logging
from pathlib import Path
from typing import Any, Dict, List

import joblib
import pandas as pd


logger = logging.getLogger(__name__)


class LifestyleMLService:
    """Service for lifestyle risk prediction using GlycoFit meta-engine artifacts."""

    DEFAULT_FEATURE_ORDER = [
        "RIDAGEYR",
        "BMXBMI",
        "DRXTKCAL",
        "DRXTSUGR",
        "ALQ130",
        "PAQ605",
        "BMXWAIST",
        "Age_BMI_Risk",
        "Sugar_Ratio",
        "Sedentary_Sugar",
        "Visceral_Index",
    ]

    def __init__(self):
        self.model = None
        self.cluster_model = None
        self.model_feature_order: List[str] = []
        self.is_initialized = False

        self.class_label_map = {
            0: "low",
            1: "moderate",
            2: "high",
        }
        self.class_score_map = {
            0: 0.0,
            1: 50.0,
            2: 100.0,
        }

    def initialize(self) -> bool:
        """Load meta model and clustering artifacts."""
        try:
            models_dir = Path(__file__).parent.parent / "models"
            model_path = models_dir / "glycofit_meta_engine.pkl"
            clusters_path = models_dir / "metabolic_clusters.pkl"

            if not model_path.exists():
                logger.warning("Lifestyle meta model not found at %s", model_path)
                return False

            if not clusters_path.exists():
                logger.warning("Metabolic clusters model not found at %s", clusters_path)
                return False

            self.model = joblib.load(model_path)
            self.cluster_model = joblib.load(clusters_path)
            self.model_feature_order = self._extract_feature_order()

            if not self.model_feature_order:
                logger.warning("No feature schema discovered in loaded models")
                return False

            self.is_initialized = True
            logger.info(
                "Lifestyle ML service initialized successfully (model=%s, clusters=%s)",
                model_path.name,
                clusters_path.name,
            )
            return True
        except ModuleNotFoundError as e:
            logger.error(
                "Failed to initialize lifestyle ML service due to missing dependency: %s",
                str(e),
                exc_info=True,
            )
            return False
        except Exception as e:
            logger.error("Failed to initialize lifestyle ML service: %s", str(e), exc_info=True)
            return False

    @staticmethod
    def _normalize_key(key: str) -> str:
        return "".join(ch for ch in str(key).lower() if ch.isalnum())

    def _extract_feature_order(self) -> List[str]:
        """Resolve feature names from model metadata with a static fallback."""
        for artifact in (self.model, self.cluster_model):
            feature_names = getattr(artifact, "feature_names_in_", None)
            if feature_names is None:
                continue
            try:
                return [str(name) for name in feature_names]
            except Exception:
                continue

        return list(self.DEFAULT_FEATURE_ORDER)

    @staticmethod
    def _to_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except Exception:
            return default

    def _flatten_inputs(self, tracker_inputs: Dict[str, Any]) -> Dict[str, float]:
        """Flatten food/activity/alcohol/profile payloads into numeric inputs."""
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

        for section in (food, activity, alcohol, profile):
            for key, value in section.items():
                add_value(key, value)

        # Derive a binary activity signal if missing.
        steps = flat.get("avg_daily_steps", flat.get("avg_steps_30d", flat.get("avg_steps")))
        if "activity_binary" not in flat and steps is not None:
            flat["activity_binary"] = 1.0 if float(steps) >= 7000 else 0.0

        if "activity_binary" not in flat and "days_goal_met" in flat:
            flat["activity_binary"] = 1.0 if float(flat["days_goal_met"]) >= 4 else 0.0

        return flat

    def prepare_features(self, tracker_inputs: Dict[str, Any]) -> pd.DataFrame:
        """Prepare model input features as a one-row DataFrame."""
        feature_order = self.model_feature_order or self._extract_feature_order()
        if not feature_order:
            raise Exception("Feature schema is empty or unreadable")

        flat_inputs = self._flatten_inputs(tracker_inputs)
        normalized_flat = {self._normalize_key(k): v for k, v in flat_inputs.items()}

        def pick(*keys: str, default: float = 0.0) -> float:
            for key in keys:
                normalized = self._normalize_key(key)
                if normalized in normalized_flat:
                    return self._to_float(normalized_flat[normalized], default)
            return default

        age = pick("RIDAGEYR", "age")
        bmi = pick("BMXBMI", "bmi")
        calories = pick("DRXTKCAL", "calories", "avg_calories")
        sugars = pick("DRXTSUGR", "added_sugars", "avg_added_sugars", "sugars")
        drinks_per_week = pick("ALQ130", "drinks_per_week", "avg_drinks_per_week_30d")
        activity_binary = pick("PAQ605", "activity_binary", "physically_active")

        activity_binary = 1.0 if activity_binary >= 0.5 else 0.0

        waist_cm = pick("BMXWAIST", "waist_cm", "waist")
        if waist_cm <= 0 and bmi > 0:
            # Approximate waist from BMI if direct profile waist is unavailable.
            waist_cm = max(50.0, min(150.0, (2.4 * bmi) + 30.0))

        age_bmi_risk = age * bmi if age > 0 and bmi > 0 else 0.0
        sugar_ratio = (sugars / calories) if calories > 0 else 0.0
        sedentary_sugar = (1.0 - activity_binary) * max(sugars, 0.0)
        visceral_index = (bmi * waist_cm / 100.0) if bmi > 0 and waist_cm > 0 else 0.0

        canonical_row = {
            "RIDAGEYR": age,
            "BMXBMI": bmi,
            "DRXTKCAL": calories,
            "DRXTSUGR": sugars,
            "ALQ130": drinks_per_week,
            "PAQ605": activity_binary,
            "BMXWAIST": waist_cm,
            "Age_BMI_Risk": age_bmi_risk,
            "Sugar_Ratio": sugar_ratio,
            "Sedentary_Sugar": sedentary_sugar,
            "Visceral_Index": visceral_index,
        }
        normalized_canonical = {
            self._normalize_key(feature_name): feature_value
            for feature_name, feature_value in canonical_row.items()
        }

        feature_row: Dict[str, float] = {}
        for feature_name in feature_order:
            value = canonical_row.get(feature_name)
            if value is None:
                value = normalized_canonical.get(self._normalize_key(feature_name), 0.0)
            feature_row[feature_name] = self._to_float(value, 0.0)

        return pd.DataFrame([feature_row], columns=feature_order)

    def classify_risk(self, predicted_class: Any) -> str:
        try:
            class_idx = int(predicted_class)
        except Exception:
            return "moderate"
        return self.class_label_map.get(class_idx, "moderate")

    def predict(self, tracker_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Predict lifestyle diabetes risk from food, activity, and alcohol inputs."""
        if not self.is_initialized:
            raise Exception("Lifestyle ML service not initialized")

        features = self.prepare_features(tracker_inputs)

        predicted_class_raw = self.model.predict(features)[0]
        try:
            predicted_class = int(predicted_class_raw)
        except Exception:
            predicted_class = 1

        risk_level = self.classify_risk(predicted_class)

        class_probabilities: Dict[int, float] = {}
        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(features)[0]
            classes = list(getattr(self.model, "classes_", []))
            if len(classes) == len(probabilities):
                for cls, prob in zip(classes, probabilities):
                    try:
                        class_probabilities[int(cls)] = float(prob)
                    except Exception:
                        continue

        if not class_probabilities:
            class_probabilities[predicted_class] = 1.0

        weighted_risk_percentage = 0.0
        for class_idx, prob in class_probabilities.items():
            weighted_risk_percentage += float(prob) * self.class_score_map.get(class_idx, 50.0)
        weighted_risk_percentage = max(0.0, min(100.0, weighted_risk_percentage))
        risk_probability = weighted_risk_percentage / 100.0

        risk_probabilities = {
            label: float(class_probabilities.get(class_idx, 0.0))
            for class_idx, label in self.class_label_map.items()
        }
        if sum(risk_probabilities.values()) == 0:
            risk_probabilities[risk_level] = 1.0

        confidence = max(class_probabilities.values()) * 100.0 if class_probabilities else 100.0

        metabolic_cluster = None
        if self.cluster_model is not None and hasattr(self.cluster_model, "predict"):
            try:
                metabolic_cluster = int(self.cluster_model.predict(features)[0])
            except Exception:
                metabolic_cluster = None

        return {
            "risk_level": risk_level,
            "probability": risk_probability,
            "percentage": weighted_risk_percentage,
            "confidence": round(confidence, 2),
            "predicted_class": predicted_class,
            "risk_probabilities": risk_probabilities,
            "metabolic_cluster": metabolic_cluster,
            "model": "glycofit_meta_engine.pkl",
            "clusters_model": "metabolic_clusters.pkl",
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