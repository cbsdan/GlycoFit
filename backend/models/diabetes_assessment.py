from datetime import datetime
from bson import ObjectId

class DiabetesAssessment:
    """Model for diabetes risk assessment"""
    
    @staticmethod
    def create(user_id, answers, prediction=None):
        """Create a new diabetes assessment"""
        return {
            'userId': ObjectId(user_id),
            'answers': answers,
            'prediction': prediction,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
    
    @staticmethod
    def update(assessment_id, answers=None, prediction=None):
        """Update an existing assessment"""
        update_data = {
            'updatedAt': datetime.utcnow()
        }
        
        if answers is not None:
            update_data['answers'] = answers
        
        if prediction is not None:
            update_data['prediction'] = prediction
        
        return update_data
    
    @staticmethod
    def validate_answers(answers):
        """Validate that all required questions are answered"""
        required_fields = [
            'HighBP', 'HighChol', 'CholCheck', 'BMI', 'Smoker', 
            'Stroke', 'HeartDiseaseorAttack', 'PhysActivity', 'Fruits', 
            'Veggies', 'HvyAlcoholConsump', 'AnyHealthcare', 'NoDocbcCost', 
            'GenHlth', 'MentHlth', 'PhysHlth', 'DiffWalk', 'Sex', 
            'Age', 'Education', 'Income'
        ]
        
        missing_fields = [field for field in required_fields if field not in answers]
        
        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}"
        
        return True, None
    
    @staticmethod
    def to_dict(assessment):
        """Convert assessment document to dictionary"""
        if not assessment:
            return None
        
        return {
            'id': str(assessment['_id']),
            'userId': str(assessment['userId']),
            'answers': assessment['answers'],
            'prediction': assessment.get('prediction'),
            'createdAt': assessment['createdAt'].isoformat(),
            'updatedAt': assessment['updatedAt'].isoformat()
        }
