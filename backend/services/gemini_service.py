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
    
    def analyze_food_image(self, image_data, note=None):
        """
        Analyze food image and return nutritional information
        
        Args:
            image_data: Binary image data
            note: Optional user note for more specific food description
            
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
            user_note_context = f"\n\nUser's additional note about the food: {note}\nPlease use this information to improve the accuracy of your analysis." if note else ""
            
            prompt = f"""
You are a nutrition estimation model that identifies food from images and predicts nutritional values using realistic data referenced from common nutrition databases such as USDA, FDA, MyFitnessPal, or standard food labels.{user_note_context}

CRITICAL REQUIREMENTS - YOU MUST FOLLOW ALL OF THESE:
1. Identify the food in the image with the most likely meal or product name.
2. When predicting nutrition, base your estimates on typical values from known databases and food labels for similar foods. Avoid unrealistic guesses.
3. Always specify the serving size used.
4. If the food is clearly a branded or known product, match it to the closest known variant from nutrition databases.
5. Rate your confidence (0–100%) based on image clarity and recognition certainty.
6. Detect individual ingredients/components in the food and provide bounding box coordinates for each detected item.
7. Bounding boxes should use pixel coordinates in the format [x_min, y_min, x_max, y_max] where coordinates represent the rectangle containing each food item.
8. Calculate Glycemic Load using the formula: GL = (GI × Carbs) / 100, where GI is the Glycemic Index of the food.
9. If no food can be identified or the image is unclear, return:
{{
  "success": false,
  "error": "Unable to identify the food from the image"
}}
10. Return your response **ONLY** as a valid JSON object with no extra text.

**MANDATORY REQUIREMENT #11 - INGREDIENT NUTRIENTS:**
YOU MUST ALWAYS detect all visible ingredients and return the nutritional breakdown for EACH ingredient in the "ingredient_nutrients" array.
- For example, if the image shows "Sirloin Steak with White Rice", you MUST provide TWO entries in ingredient_nutrients:
  1. One for "Sirloin Steak" with its individual nutrients
  2. One for "White Rice" with its individual nutrients
- The sum of ALL ingredient-level nutrients MUST exactly equal the overall "nutrients" totals.
- NEVER return an empty ingredient_nutrients array if you can detect food components.
- If it's a single-ingredient food, still provide ONE entry in ingredient_nutrients for that ingredient.
- Do not reduce, normalize, or omit any values. Totals must be mathematically consistent.

For valid food images, use exactly this JSON format (INGREDIENT_NUTRIENTS IS REQUIRED):
{{
    "success": true,
    "meal_name": "Name of the food/meal",
    "serving_size": "Specific serving size",
    "nutrients": {{
        "Calories": <number>,
        "Carbs (g)": <number>,
        "Added Sugars (g)": <number>,
        "Fiber (g)": <number>,
        "Protein (g)": <number>,
        "Fat (g)": <number>,
        "Saturated Fat (g)": <number>,
        "Unsaturated Fat (g)": <number>,
        "Sodium (mg)": <number>,
        "Glycemic Load": <number>
    }},
    "confidence_percentage": <number between 0-100>,
    "confidence_explanation": "Brief 1-2 sentence explanation of why this confidence rate (e.g., 'Clear image with easily identifiable food items' or 'Image clarity is moderate, making nutrient estimation approximate')",
    "health_assessment": "Brief 2-3 sentence assessment of whether this food is healthy or unhealthy for avoiding prediabetes/diabetes type 2. Mention key concerns like high glycemic load, added sugars, saturated fats, or positive aspects like fiber content, low glycemic index, whole grains. Be specific and actionable.",
    "recipes": [
        {{
            "box_2d": [x_min, y_min, x_max, y_max],
            "label": "Ingredient or component name"
        }}
    ],
    "ingredient_nutrients": [
        {{
            "ingredient": "First ingredient name (e.g., 'Sirloin Steak')",
            "serving_size": "Ingredient-specific serving size (e.g., '6 oz')",
            "nutrients": {{
                "Calories": <number>,
                "Carbs (g)": <number>,
                "Added Sugars (g)": <number>,
                "Fiber (g)": <number>,
                "Protein (g)": <number>,
                "Fat (g)": <number>,
                "Saturated Fat (g)": <number>,
                "Unsaturated Fat (g)": <number>,
                "Sodium (mg)": <number>,
                "Glycemic Load": <number>
            }}
        }},
        {{
            "ingredient": "Second ingredient name (e.g., 'White Rice')",
            "serving_size": "Ingredient-specific serving size (e.g., '1 cup')",
            "nutrients": {{
                "Calories": <number>,
                "Carbs (g)": <number>,
                "Added Sugars (g)": <number>,
                "Fiber (g)": <number>,
                "Protein (g)": <number>,
                "Fat (g)": <number>,
                "Saturated Fat (g)": <number>,
                "Unsaturated Fat (g)": <number>,
                "Sodium (mg)": <number>,
                "Glycemic Load": <number>
            }}
        }}
    ]
}}

For non-food images or unclear images, use this exact JSON format:
{{
    "success": false,
    "error": "Cannot detect food in the image",
    "message": "Please upload a clear image of food",
    "confidence_percentage": 0
}}

Bounding box guidelines:
- Use pixel coordinates in format [x_min, y_min, x_max, y_max]
- x_min, y_min: top-left corner of the bounding box (in pixels)
- x_max, y_max: bottom-right corner of the bounding box (in pixels)
- Each detected food item/ingredient should have its own bounding box
- Estimate reasonable coordinates based on typical image dimensions (e.g., 1000x1000)

Recipe/Ingredient detection guidelines:
- List all identifiable ingredients or components visible in the food in BOTH "recipes" and "ingredient_nutrients" arrays
- For complex meals, break down into individual components (e.g., "Sirloin Steak", "White Rice", "Scallion Garnish")
- For simple foods, list the main item and any visible toppings or accompaniments
- Provide accurate bounding boxes for each detected component in the "recipes" array
- CRITICAL: For EACH item in the "recipes" array, you MUST provide a corresponding entry in "ingredient_nutrients" with full nutritional breakdown
- Example: If recipes has 2 items like Sirloin Steak and White Rice, then ingredient_nutrients MUST have 2 entries for those same items
- If no distinct components can be identified, treat the entire meal as ONE ingredient and provide ONE entry in ingredient_nutrients
- Nutrients listed in "ingredient_nutrients" must sum exactly to the values in "nutrients"
- NEVER return an empty ingredient_nutrients array - always provide at least ONE ingredient entry

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
                                        'Fiber (g)', 'Protein (g)', 'Fat (g)', 
                                        'Saturated Fat (g)', 'Unsaturated Fat (g)', 
                                        'Sodium (mg)', 'Glycemic Load']
                    for nutrient in required_nutrients:
                        if nutrient not in result['nutrients']:
                            result['nutrients'][nutrient] = 0.0
                    
                    # Ensure confidence_percentage is present and valid
                    if 'confidence_percentage' not in result:
                        result['confidence_percentage'] = 50  # Default to 50% if not provided
                    else:
                        # Ensure it's between 0-100
                        result['confidence_percentage'] = max(0, min(100, float(result['confidence_percentage'])))
                    
                    # Ensure recipes field is present
                    if 'recipes' not in result:
                        result['recipes'] = []
                    
                    # Validate recipes structure
                    if not isinstance(result['recipes'], list):
                        result['recipes'] = []
                    
                    # Ensure ingredient_nutrients field is present
                    if 'ingredient_nutrients' not in result:
                        result['ingredient_nutrients'] = []
                    
                    # Validate ingredient_nutrients structure
                    if not isinstance(result['ingredient_nutrients'], list):
                        result['ingredient_nutrients'] = []
                    
                    # Validate each ingredient nutrient entry
                    for ingredient in result['ingredient_nutrients']:
                        if not isinstance(ingredient, dict):
                            continue
                        # Ensure required fields are present
                        if 'ingredient' not in ingredient:
                            ingredient['ingredient'] = 'Unknown Ingredient'
                        if 'nutrients' not in ingredient:
                            ingredient['nutrients'] = {}
                        # Ensure all required nutrients are present in ingredient
                        for nutrient in required_nutrients:
                            if nutrient not in ingredient['nutrients']:
                                ingredient['nutrients'][nutrient] = 0.0
                    
                    logging.info(f"Gemini successfully analyzed food: {result['meal_name']} (Confidence: {result['confidence_percentage']}%, Recipes: {len(result['recipes'])}, Ingredients: {len(result['ingredient_nutrients'])})")
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
    
    def analyze_food_from_text(self, food_description):
        """
        Analyze food from text description and return nutritional information
        
        Args:
            food_description: Text description of the food/meal
            
        Returns:
            dict: Nutritional information including:
                - meal_name: Name of the detected food
                - nutrients: Dict with nutritional values
                - confidence: Estimation confidence
        """
        try:
            if not self.is_ready():
                raise Exception("Gemini service is not initialized")
            
            # Use gemini-3.0-flash for text analysis
            text_model = genai.GenerativeModel('gemini-2.5-flash')
            
            prompt = f"""
You are a nutrition estimation model that analyzes food descriptions and provides nutritional values using realistic data referenced from common nutrition databases such as USDA, FDA, MyFitnessPal, or standard food labels.

User's food description: {food_description}

CRITICAL REQUIREMENTS - YOU MUST FOLLOW ALL OF THESE:
1. Identify the food/meal from the text description.
2. When predicting nutrition, base your estimates on typical values from known databases and food labels for similar foods. Avoid unrealistic guesses.
3. Always specify the serving size used for the estimate.
4. If the food is clearly a branded or known product, match it to the closest known variant from nutrition databases.
5. Rate your confidence (0–100%) based on description clarity and recognition certainty.
6. Detect individual ingredients/components in the meal and provide nutritional breakdown for each.
7. Calculate Glycemic Load using the formula: GL = (GI × Carbs) / 100, where GI is the Glycemic Index of the food.
8. If no food can be identified or the description is unclear, return:
{{
  "success": false,
  "error": "Unable to identify the food from the description"
}}
9. Return your response **ONLY** as a valid JSON object with no extra text.

**MANDATORY REQUIREMENT #10 - INGREDIENT NUTRIENTS:**
YOU MUST ALWAYS detect all mentioned ingredients and return the nutritional breakdown for EACH ingredient in the "ingredient_nutrients" array.
- For example, if the description is "Grilled chicken with brown rice and broccoli", you MUST provide THREE entries in ingredient_nutrients:
  1. One for "Grilled Chicken" with its individual nutrients
  2. One for "Brown Rice" with its individual nutrients
  3. One for "Broccoli" with its individual nutrients
- The sum of ALL ingredient-level nutrients MUST exactly equal the overall "nutrients" totals.
- NEVER return an empty ingredient_nutrients array if you can detect food components.
- If it's a single-ingredient food, still provide ONE entry in ingredient_nutrients for that ingredient.
- Do not reduce, normalize, or omit any values. Totals must be mathematically consistent.

For valid food descriptions, use exactly this JSON format (INGREDIENT_NUTRIENTS IS REQUIRED):
{{
    "success": true,
    "meal_name": "Name of the food/meal",
    "serving_size": "Specific serving size",
    "nutrients": {{
        "Calories": <number>,
        "Carbs (g)": <number>,
        "Added Sugars (g)": <number>,
        "Fiber (g)": <number>,
        "Protein (g)": <number>,
        "Fat (g)": <number>,
        "Saturated Fat (g)": <number>,
        "Unsaturated Fat (g)": <number>,
        "Sodium (mg)": <number>,
        "Glycemic Load": <number>
    }},
    "confidence_percentage": <number between 0-100>,
    "confidence_explanation": "Brief 1-2 sentence explanation of why this confidence rate (e.g., 'Detailed description provided allows for accurate nutrient estimation' or 'Description is somewhat vague, making estimates approximate')",
    "health_assessment": "Brief 2-3 sentence assessment of whether this food is healthy or unhealthy for avoiding prediabetes/diabetes type 2. Mention key concerns like high glycemic load, added sugars, saturated fats, or positive aspects like fiber content, low glycemic index, whole grains. Be specific and actionable.",
    "ingredient_nutrients": [
        {{
            "ingredient": "First ingredient name (e.g., 'Grilled Chicken')",
            "serving_size": "Ingredient-specific serving size (e.g., '6 oz')",
            "nutrients": {{
                "Calories": <number>,
                "Carbs (g)": <number>,
                "Added Sugars (g)": <number>,
                "Fiber (g)": <number>,
                "Protein (g)": <number>,
                "Fat (g)": <number>,
                "Saturated Fat (g)": <number>,
                "Unsaturated Fat (g)": <number>,
                "Sodium (mg)": <number>,
                "Glycemic Load": <number>
            }}
        }},
        {{
            "ingredient": "Second ingredient name (e.g., 'Brown Rice')",
            "serving_size": "Ingredient-specific serving size (e.g., '1 cup')",
            "nutrients": {{
                "Calories": <number>,
                "Carbs (g)": <number>,
                "Added Sugars (g)": <number>,
                "Fiber (g)": <number>,
                "Protein (g)": <number>,
                "Fat (g)": <number>,
                "Saturated Fat (g)": <number>,
                "Unsaturated Fat (g)": <number>,
                "Sodium (mg)": <number>,
                "Glycemic Load": <number>
            }}
        }}
    ]
}}

For unclear descriptions, use this exact JSON format:
{{
    "success": false,
    "error": "Cannot identify food from description",
    "message": "Please provide a clearer food description",
    "confidence_percentage": 0
}}

Confidence rating guidelines:
- 90-100%: Very specific description, easily identifiable food, confident in nutritional estimates
- 70-89%: Good description, recognizable food, good nutritional estimates
- 50-69%: Somewhat specific, food is identifiable but estimates are approximate
- 30-49%: Vague description or difficult to identify food accurately
- 0-29%: Very vague or cannot identify food

Provide realistic nutritional estimates based on typical serving sizes. Return ONLY the JSON object.
"""
            
            # Generate content with the text
            response = text_model.generate_content(prompt)
            
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
                                        'Fiber (g)', 'Protein (g)', 'Fat (g)', 
                                        'Saturated Fat (g)', 'Unsaturated Fat (g)', 
                                        'Sodium (mg)', 'Glycemic Load']
                    for nutrient in required_nutrients:
                        if nutrient not in result['nutrients']:
                            result['nutrients'][nutrient] = 0.0
                    
                    # Ensure confidence_percentage is present and valid
                    if 'confidence_percentage' not in result:
                        result['confidence_percentage'] = 50
                    else:
                        result['confidence_percentage'] = max(0, min(100, float(result['confidence_percentage'])))
                    
                    # Ensure ingredient_nutrients field is present
                    if 'ingredient_nutrients' not in result:
                        result['ingredient_nutrients'] = []
                    
                    # Validate ingredient_nutrients structure
                    if not isinstance(result['ingredient_nutrients'], list):
                        result['ingredient_nutrients'] = []
                    
                    # Validate each ingredient nutrient entry
                    for ingredient in result['ingredient_nutrients']:
                        if not isinstance(ingredient, dict):
                            continue
                        if 'ingredient' not in ingredient:
                            ingredient['ingredient'] = 'Unknown Ingredient'
                        if 'nutrients' not in ingredient:
                            ingredient['nutrients'] = {}
                        for nutrient in required_nutrients:
                            if nutrient not in ingredient['nutrients']:
                                ingredient['nutrients'][nutrient] = 0.0
                    
                    logging.info(f"Gemini successfully analyzed food from text: {result['meal_name']} (Confidence: {result['confidence_percentage']}%, Ingredients: {len(result['ingredient_nutrients'])})")
                    return result
                else:
                    # Food not detected
                    if 'confidence_percentage' not in result:
                        result['confidence_percentage'] = 0
                    logging.warning("Gemini could not identify food from description")
                    return result
                    
            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse Gemini response as JSON: {response_text}")
                return {
                    'success': False,
                    'error': 'Cannot identify food from description',
                    'message': 'Unable to analyze the description. Please provide more details.',
                    'confidence_percentage': 0
                }
            
        except Exception as e:
            logging.error(f"Error analyzing food from text with Gemini: {str(e)}")
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
