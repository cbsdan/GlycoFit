import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
from PIL import Image
import logging
import os
import io

class NutrientPredictor(nn.Module):
    def __init__(self, num_nutrients=4):
        super(NutrientPredictor, self).__init__()
        # Load a pre-trained ResNet model
        resnet = models.resnet50(pretrained=True)
        # Remove the original fully connected layer
        self.features = nn.Sequential(*list(resnet.children())[:-1])
        # Add a new fully connected layer for nutrient prediction
        self.regressor = nn.Linear(resnet.fc.in_features, num_nutrients)
    
    def forward(self, x):
        x = self.features(x)
        x = torch.flatten(x, 1)
        x = self.regressor(x)
        return x

class MLModelService:
    def __init__(self):
        self.model = None
        self.device = None
        self.transform = None
        self.nutrient_names = ['Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)']
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the ML model and preprocessing transforms"""
        try:
            # Set device (CPU or GPU)
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            logging.info(f"Using device: {self.device}")
            
            # Initialize the model
            self.model = NutrientPredictor()
            
            # Load the trained model weights
            model_path = os.path.join(os.path.dirname(__file__), '..', 'nutrient_predictor_model.pth')
            
            if os.path.exists(model_path):
                self.model.load_state_dict(torch.load(model_path, map_location=self.device))
                self.model.to(self.device)
                self.model.eval()
                logging.info("✅ ML Model loaded successfully and set to evaluation mode.")
            else:
                logging.error(f"Model file not found at: {model_path}")
                raise FileNotFoundError(f"Model file not found at: {model_path}")
            
            # Initialize image preprocessing transforms
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            
        except Exception as e:
            logging.error(f"Failed to initialize ML model: {str(e)}")
            raise e
    
    def preprocess_image(self, image_data):
        """
        Preprocess image data for model inference
        
        Args:
            image_data: Raw image data (bytes)
            
        Returns:
            Preprocessed image tensor
        """
        try:
            # Convert bytes to PIL Image
            if isinstance(image_data, bytes):
                image = Image.open(io.BytesIO(image_data))
            else:
                image = image_data
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Apply transformations
            processed_img = self.transform(image)
            
            # Add batch dimension
            processed_img = processed_img.unsqueeze(0)
            
            # Move to device
            processed_img = processed_img.to(self.device)
            
            return processed_img
            
        except Exception as e:
            logging.error(f"Error preprocessing image: {str(e)}")
            raise e
    
    def predict_nutrients(self, image_data):
        """
        Predict nutrient values from image data
        
        Args:
            image_data: Raw image data (bytes or PIL Image)
            
        Returns:
            Dictionary containing predicted nutrient values
        """
        try:
            if self.model is None:
                raise RuntimeError("Model not initialized")
            
            # Preprocess the image
            processed_img = self.preprocess_image(image_data)
            
            # Get predictions from the model
            with torch.no_grad():
                predictions = self.model(processed_img)
            
            # Convert predictions to numpy array
            predictions_np = predictions.squeeze().cpu().numpy()
            
            # Create result dictionary
            result = {
                'success': True,
                'nutrients': {}
            }
            
            # Map predictions to nutrient names
            for name, value in zip(self.nutrient_names, predictions_np):
                # Ensure non-negative values and round to 2 decimal places
                result['nutrients'][name] = max(0, round(float(value), 2))
            
            logging.info(f"✅ Nutrient prediction completed: {result['nutrients']}")
            return result
            
        except Exception as e:
            logging.error(f"Error during nutrient prediction: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'nutrients': {}
            }
    
    def is_model_ready(self):
        """Check if the model is ready for predictions"""
        return self.model is not None

# Global instance
ml_service = None

def init_ml_service():
    """Initialize the ML service"""
    global ml_service
    try:
        ml_service = MLModelService()
        logging.info("ML Service initialized successfully")
        return True
    except Exception as e:
        logging.error(f"Failed to initialize ML Service: {str(e)}")
        return False

def get_ml_service():
    """Get the global ML service instance"""
    global ml_service
    if ml_service is None:
        if not init_ml_service():
            raise RuntimeError("ML Service not available")
    return ml_service
