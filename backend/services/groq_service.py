import os
import logging
from groq import Groq

class GroqService:
    def __init__(self):
        self.api_key = os.getenv('GROQ_API_KEY')
        self.client = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Groq API client"""
        try:
            if not self.api_key:
                raise ValueError("GROQ_API_KEY not found in environment variables")
            
            self.client = Groq(api_key=self.api_key)
            logging.info("Groq service initialized successfully")
            
        except Exception as e:
            logging.error(f"Failed to initialize Groq service: {str(e)}")
            raise
    
    def is_ready(self):
        """Check if Groq service is ready"""
        return self.client is not None
    
    def generate_health_response(self, user_message, user_id=None):
        """
        Generate a health-related conversational response using Groq AI
        
        Args:
            user_message: User's message text
            user_id: Optional user ID for personalized responses
            
        Returns:
            str: AI-generated response
        """
        try:
            if not self.is_ready():
                raise Exception("Groq service is not initialized")
            
            # Create a health assistant prompt
            system_prompt = """You are a helpful health assistant for GlycoFit, an app focused on diabetes management and healthy living.

Your role:
- Provide accurate, helpful information about diabetes management, nutrition, and healthy lifestyle
- Be supportive and encouraging
- Give practical advice for meal planning, blood sugar monitoring, and exercise
- When asked about specific symptoms or medical concerns, always recommend consulting with healthcare professionals
- Use a friendly, conversational tone
- Keep responses concise but informative (2-4 sentences typically)

Important guidelines:
- NEVER provide medical diagnosis or replace professional medical advice
- ALWAYS encourage users to consult their doctor for medical decisions
- Focus on general wellness, nutrition education, and lifestyle tips
- Be positive and motivating
- If asked about medications, recommend consulting their physician"""
            
            # Call Groq API
            message = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",  # Latest Groq model (mixtral-8x7b-32768 is deprecated)
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_message
                    }
                ],
                temperature=0.7,
                max_tokens=1024,
                top_p=1
            )
            
            response_text = message.choices[0].message.content.strip()
            
            logging.info(f"Generated health response using Groq for message: {user_message[:50]}...")
            return response_text
            
        except Exception as e:
            logging.error(f"Error generating health response with Groq: {str(e)}")
            raise


# Global instance
_groq_service = None

def init_groq_service():
    """Initialize the global Groq service instance"""
    global _groq_service
    try:
        _groq_service = GroqService()
        logging.info("Groq service initialized")
    except Exception as e:
        logging.error(f"Failed to initialize Groq service: {str(e)}")
        _groq_service = None

def get_groq_service():
    """Get the global Groq service instance"""
    return _groq_service
