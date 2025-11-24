import joblib
import numpy as np
import pandas as pd
import logging
import os
from pathlib import Path

class DiabetesPredictionService:
    """Service for diabetes risk prediction using ML model"""
    
    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.is_initialized = False
        
        # Risk thresholds based on calibrated model
        self.risk_thresholds = {
            'low': (0.0117, 0.3379),
            'moderate': (0.3379, 0.7017),
            'high': (0.7017, 0.9422)
        }
    
    def initialize(self):
        """Load the model and preprocessor"""
        try:
            models_dir = Path(__file__).parent.parent / 'models'
            model_path = models_dir / 'diabetes_model.pkl'
            preprocessor_path = models_dir / 'diabetes_preprocessor.pkl'
            
            if not model_path.exists():
                logging.warning(f"Diabetes model not found at {model_path}")
                return False
            
            if not preprocessor_path.exists():
                logging.warning(f"Diabetes preprocessor not found at {preprocessor_path}")
                return False
            
            # Load model with joblib
            self.model = joblib.load(model_path)
            
            # Load preprocessor with joblib
            self.preprocessor = joblib.load(preprocessor_path)
            
            self.is_initialized = True
            logging.info("Diabetes prediction service initialized successfully")
            return True
            
        except Exception as e:
            logging.error(f"Failed to initialize diabetes prediction service: {str(e)}")
            import traceback
            logging.error(traceback.format_exc())
            return False
    
    def prepare_features(self, answers):
        """Prepare features from assessment answers in the correct order as DataFrame"""
        # Feature order must match your training data
        feature_order = [
            'HighBP', 'HighChol', 'CholCheck', 'BMI', 'Smoker',
            'Stroke', 'HeartDiseaseorAttack', 'PhysActivity', 'Fruits',
            'Veggies', 'HvyAlcoholConsump', 'AnyHealthcare', 'NoDocbcCost',
            'GenHlth', 'MentHlth', 'PhysHlth', 'DiffWalk', 'Sex',
            'Age', 'Education', 'Income'
        ]
        
        # Extract features in correct order as a dictionary
        feature_dict = {key: [float(answers[key])] for key in feature_order}
        
        # Create DataFrame
        return pd.DataFrame(feature_dict)
    
    def classify_risk(self, probability):
        """Classify risk level based on probability"""
        if probability < self.risk_thresholds['moderate'][0]:
            return 'low'
        elif probability < self.risk_thresholds['high'][0]:
            return 'moderate'
        else:
            return 'high'
    
    def predict(self, answers):
        """
        Make prediction from assessment answers
        
        Returns:
            dict: {
                'risk_level': 'low' | 'moderate' | 'high',
                'probability': float (0-1),
                'percentage': float (0-100),
                'confidence': float (0-100)
            }
        """
        if not self.is_initialized:
            raise Exception("Diabetes prediction service not initialized")
        
        try:
            # Prepare features
            features = self.prepare_features(answers)
            
            # Apply preprocessing if preprocessor exists
            if self.preprocessor is not None:
                features = self.preprocessor.transform(features)
            
            # Get probability prediction (probability of diabetes)
            # For binary classification, predict_proba returns [prob_no_diabetes, prob_diabetes]
            probabilities = self.model.predict_proba(features)[0]
            diabetes_probability = probabilities[1]  # Probability of having diabetes
            
            # Classify risk level
            risk_level = self.classify_risk(diabetes_probability)
            
            # Calculate confidence based on how far from threshold boundaries
            if risk_level == 'low':
                distance_from_threshold = (self.risk_thresholds['moderate'][0] - diabetes_probability) / self.risk_thresholds['moderate'][0]
            elif risk_level == 'moderate':
                mid_point = (self.risk_thresholds['moderate'][0] + self.risk_thresholds['high'][0]) / 2
                distance_from_mid = abs(diabetes_probability - mid_point)
                distance_from_threshold = 1 - (distance_from_mid / (self.risk_thresholds['high'][0] - self.risk_thresholds['moderate'][0]))
            else:  # high
                distance_from_threshold = (diabetes_probability - self.risk_thresholds['high'][0]) / (1 - self.risk_thresholds['high'][0])
            
            confidence = min(100, max(60, distance_from_threshold * 100))  # Between 60-100%
            
            result = {
                'risk_level': risk_level,
                'probability': float(diabetes_probability),
                'percentage': float(diabetes_probability * 100),
                'confidence': float(confidence)
            }
            
            logging.info(f"Diabetes prediction completed: {risk_level} risk with {diabetes_probability:.2%} probability")
            return result
            
        except Exception as e:
            logging.error(f"Error during diabetes prediction: {str(e)}")
            raise Exception(f"Prediction failed: {str(e)}")


# Global service instance
_diabetes_service = None

def get_diabetes_service():
    """Get or create the global diabetes prediction service"""
    global _diabetes_service
    if _diabetes_service is None:
        _diabetes_service = DiabetesPredictionService()
        _diabetes_service.initialize()
    return _diabetes_service

def init_diabetes_service():
    """Initialize the diabetes prediction service"""
    global _diabetes_service
    _diabetes_service = DiabetesPredictionService()
    return _diabetes_service.initialize()
