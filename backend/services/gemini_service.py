import os
import logging
import google.generativeai as genai
from PIL import Image
import io
import json

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        self.model = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Gemini API"""
        try:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY not found in environment variables")
            
            genai.configure(api_key=self.api_key)
            # Using gemini-2.0-flash-exp - Fast and capable model for food analysis
            # This model supports generateContent and is available in your API
            self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
            logging.info("Gemini AI service initialized successfully with model: gemini-2.5-flash-lite")
            
        except Exception as e:
            logging.error(f"Failed to initialize Gemini AI: {str(e)}")
            raise
    
    def is_ready(self):
        """Check if Gemini service is ready"""
        return self.model is not None
    
    def analyze_food_image(self, image_data):
        """
        Analyze food image and return nutritional information
        
        Args:
            image_data: Binary image data
            
        Returns:
            dict: Nutritional information including:
                - meal_name: Name of the detected food
                - nutrients: Dict with nutritional values
                - confidence: Detection confidence
        """
        try:
            if not self.is_ready():
                raise Exception("Gemini service is not initialized")
            
            # Convert image data to PIL Image
            image = Image.open(io.BytesIO(image_data))
            
            # Create the prompt for nutritional analysis
            prompt = """
You are a nutrition estimation model that identifies food from images and predicts nutritional values using realistic data referenced from common nutrition databases such as USDA, FDA, MyFitnessPal, or standard food labels.

STRONG RULES TO FOLLOW:
1. Identify the food in the image with the most likely meal or product name.
2. When predicting nutrition, base your estimates on typical values from known databases and food labels for similar foods. Avoid unrealistic guesses.
3. Always specify the serving size used.
4. If the food is clearly a branded or known product, match it to the closest known variant from nutrition databases.
5. Rate your confidence (0–100%) based on image clarity and recognition certainty.
6. If no food can be identified or the image is unclear, return:
{
  "success": false,
  "error": "Unable to identify the food from the image"
}
7. Return your response **ONLY** as a valid JSON object with no extra text.

For valid food images, use exactly this JSON format:
{
    "success": true,
    "meal_name": "Name of the food/meal",
    "serving_size": "Specific serving size",
    "nutrients": {
        "Calories": <number>,
        "Carbs (g)": <number>,
        "Added Sugars (g)": <number>,
        "Fiber (g)": <number>,
        "Protein (g)": <number>,
        "Fat (g)": <number>
    },
    "confidence_percentage": <number between 0-100>
}

For non-food images or unclear images, use this exact JSON format:
{
    "success": false,
    "error": "Cannot detect food in the image",
    "message": "Please upload a clear image of food",
    "confidence_percentage": 0
}

Confidence rating guidelines:
- 90-100%: Very clear image, easily identifiable food, confident in nutritional estimates
- 70-89%: Clear image, recognizable food, good nutritional estimates
- 50-69%: Somewhat clear, food is identifiable but estimates are approximate
- 30-49%: Unclear image or difficult to identify food accurately
- 0-29%: Very unclear or cannot identify food

Provide realistic nutritional estimates based on typical serving sizes. Return ONLY the JSON object.
"""
            
            # Generate content with the image
            response = self.model.generate_content([prompt, image])
            
            # Parse the response
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            
            # Parse JSON response
            try:
                result = json.loads(response_text)
                
                # Validate the response structure
                if result.get('success'):
                    # Valid food detection
                    if 'meal_name' not in result or 'nutrients' not in result:
                        raise ValueError("Invalid response structure from Gemini")
                    
                    # Ensure all required nutrients are present
                    required_nutrients = ['Calories', 'Carbs (g)', 'Added Sugars (g)', 
                                        'Fiber (g)', 'Protein (g)', 'Fat (g)']
                    for nutrient in required_nutrients:
                        if nutrient not in result['nutrients']:
                            result['nutrients'][nutrient] = 0.0
                    
                    # Ensure confidence_percentage is present and valid
                    if 'confidence_percentage' not in result:
                        result['confidence_percentage'] = 50  # Default to 50% if not provided
                    else:
                        # Ensure it's between 0-100
                        result['confidence_percentage'] = max(0, min(100, float(result['confidence_percentage'])))
                    
                    logging.info(f"Gemini successfully analyzed food: {result['meal_name']} (Confidence: {result['confidence_percentage']}%)")
                    return result
                else:
                    # Food not detected
                    if 'confidence_percentage' not in result:
                        result['confidence_percentage'] = 0
                    logging.warning("Gemini could not detect food in image")
                    return result
                    
            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse Gemini response as JSON: {response_text}")
                return {
                    'success': False,
                    'error': 'Cannot detect food in the image',
                    'message': 'Unable to analyze the image. Please try another image.',
                    'confidence_percentage': 0
                }
            
        except Exception as e:
            logging.error(f"Error analyzing food image with Gemini: {str(e)}")
            raise

# Global instance
_gemini_service = None

def init_gemini_service():
    """Initialize the global Gemini service instance"""
    global _gemini_service
    try:
        _gemini_service = GeminiService()
        logging.info("Gemini service initialized")
    except Exception as e:
        logging.error(f"Failed to initialize Gemini service: {str(e)}")
        _gemini_service = None

def get_gemini_service():
    """Get the global Gemini service instance"""
    return _gemini_service
