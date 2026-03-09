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
    
    def generate_health_response(self, user_message, user_id=None, user_health_context=None):
        """
        Generate a health-related conversational response using Groq AI
        
        Args:
            user_message: User's message text
            user_id: Optional user ID for personalized responses
            user_health_context: Optional dict with user's health profile and risk data
            
        Returns:
            str: AI-generated response
        """
        try:
            if not self.is_ready():
                raise Exception("Groq service is not initialized")
            
            # Create a health assistant prompt
            system_prompt = _build_system_prompt(user_health_context)
            
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


def _build_system_prompt(ctx: dict = None) -> str:
    """
    Build the system prompt for the AI, injecting the user's personal
    health profile and risk assessment data when available.
    """
    base = (
        "You are a helpful, empathetic health assistant for GlycoFit, "
        "an app focused on diabetes prevention and management.\n\n"
        "Your role:\n"
        "- Provide accurate, helpful information about diabetes, nutrition, and healthy lifestyle.\n"
        "- Be supportive and encouraging.\n"
        "- Give practical, personalised advice based on the user's health profile below (when available).\n"
        "- When asked about specific symptoms or medical concerns, always recommend consulting a healthcare professional.\n"
        "- Use a friendly, conversational tone.\n"
        "- Keep responses concise but informative (2-4 sentences typically).\n\n"
        "Important guidelines:\n"
        "- NEVER provide medical diagnosis or replace professional medical advice.\n"
        "- ALWAYS encourage users to consult their doctor for medical decisions.\n"
        "- Focus on general wellness, nutrition education, and lifestyle tips.\n"
        "- Be positive and motivating.\n"
        "- If asked about medications, recommend consulting their physician.\n"
    )

    if not ctx:
        return base

    # --- health context block (no PII) ---
    profile_lines = ["\n--- USER HEALTH CONTEXT ---"]

    diagnosis = ctx.get('diagnosis_status', 'not_diagnosed')
    diagnosis_labels = {
        'not_diagnosed': 'Not diagnosed with diabetes',
        'prediabetes': 'Diagnosed with Prediabetes',
        'type2_diabetes': 'Diagnosed with Type 2 Diabetes',
    }
    profile_lines.append(f"Diagnosis status: {diagnosis_labels.get(diagnosis, diagnosis)}")

    risk_cat = ctx.get('overall_risk_category')
    if risk_cat:
        profile_lines.append(
            f"Overall diabetes risk category: {risk_cat.replace('_', ' ').title()}"
        )

    components = ctx.get('component_scores')
    if components:
        profile_lines.append("Lifestyle factor status:")
        for label, info in components.items():
            status = info.get('status') or ''
            detail = info.get('details') or ''
            profile_lines.append(f"  • {label}: {detail or status}")

    risk_factors = ctx.get('primary_risk_factors')
    if risk_factors:
        profile_lines.append(f"Top risk areas: {', '.join(risk_factors)}")

    recs = ctx.get('recommendations')
    if recs:
        profile_lines.append("Personalised recommendations from their assessment:")
        for r in recs:
            profile_lines.append(f"  - {r}")

    profile_lines.append(
        "\nUse this context to tailor your responses. Reference the user's specific "
        "risk areas and recommendations when relevant, but do not recite this data "
        "back verbatim — use it naturally in conversation.\n"
        "--- END HEALTH CONTEXT ---"
    )

    return base + "\n".join(profile_lines)
