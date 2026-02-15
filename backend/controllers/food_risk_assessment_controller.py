from flask import request, jsonify
from middleware.firebase_auth import firebase_auth_required, get_current_user_id
from models.food_baseline_assessment import FoodBaselineAssessment
from models.food_explanation import FoodExplanation
from services.food_tracking_service import FoodTrackingService
import logging

class FoodRiskAssessmentController:
    
    @staticmethod
    def get_baseline_questions():
        """
        Get baseline assessment questions
        
        Returns:
        - JSON response with all baseline questions
        """
        try:
            questions = FoodBaselineAssessment.get_baseline_questions()
            
            return jsonify({
                'success': True,
                'message': 'Baseline questions retrieved successfully',
                'data': {
                    'questions': questions,
                    'total_questions': len(questions)
                }
            }), 200
            
        except Exception as e:
            logging.error(f"Error getting baseline questions: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    @firebase_auth_required
    def submit_baseline_assessment():
        """
        Submit or update baseline assessment responses
        
        Expected request:
        - JSON body with:
          - responses: Dict with question keys and user responses
        
        Returns:
        - JSON response with assessment ID and calculated risk score
        """
        try:
            user_id = get_current_user_id()
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400
            
            responses = data.get('responses')
            
            if not responses:
                return jsonify({
                    'success': False,
                    'error': 'Responses are required'
                }), 400
            
            # Validate responses against valid questions
            valid_questions = set(FoodBaselineAssessment.BASELINE_QUESTIONS.keys())
            for key in responses.keys():
                if key not in valid_questions:
                    return jsonify({
                        'success': False,
                        'error': f'Invalid question key: {key}'
                    }), 400
            
            # Create or update baseline assessment
            result = FoodBaselineAssessment.create_or_update_baseline(user_id, responses)
            
            if not result['success']:
                return jsonify(result), 500
            
            # Calculate risk score
            risk_result = FoodBaselineAssessment.update_baseline_risk_score(user_id)
            
            if risk_result['success']:
                return jsonify({
                    'success': True,
                    'message': result['message'],
                    'data': {
                        'assessment_id': result['assessment_id'],
                        'baseline_risk_score': risk_result['baseline_risk_score']
                    }
                }), 200
            else:
                return jsonify({
                    'success': True,
                    'message': result['message'],
                    'data': {
                        'assessment_id': result['assessment_id']
                    },
                    'warning': 'Risk score calculation failed'
                }), 200
                
        except Exception as e:
            logging.error(f"Error submitting baseline assessment: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    @firebase_auth_required
    def get_user_baseline():
        """
        Get user's baseline assessment
        
        Returns:
        - JSON response with user's baseline assessment and responses
        """
        try:
            user_id = get_current_user_id()
            
            result = FoodBaselineAssessment.get_user_baseline(user_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': 'Baseline assessment retrieved successfully',
                    'data': result.get('baseline')
                }), 200
            else:
                return jsonify(result), 500
                
        except Exception as e:
            logging.error(f"Error getting user baseline: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    @firebase_auth_required
    def get_risk_assessment():
        """
        Get comprehensive prediabetes risk assessment
        
        Query parameters:
        - days: Number of days to analyze for daily logs (default: 7)
        
        Returns:
        - JSON response with comprehensive risk assessment
        """
        try:
            user_id = get_current_user_id()
            
            # Get query parameters
            days = int(request.args.get('days', 7))
            
            # Validate days parameter
            if days < 1 or days > 90:
                return jsonify({
                    'success': False,
                    'error': 'Days parameter must be between 1 and 90'
                }), 400
            
            # Calculate comprehensive risk
            result = FoodTrackingService.calculate_comprehensive_risk(user_id, days)
            
            if result['success']:
                response_data = {
                    'success': True,
                    'message': 'Risk assessment completed successfully',
                    'data': {
                        'comprehensive_risk_score': result['comprehensive_risk_score'],
                        'risk_category': result['risk_category'],
                        'risk_message': result['risk_message'],
                        'breakdown': result['breakdown']
                    }
                }
                
                # Include data quality warning if present
                if result.get('warning'):
                    response_data['data']['warning'] = result['warning']
                    response_data['data']['data_quality'] = result.get('data_quality', 'unknown')
                
                return jsonify(response_data), 200
            else:
                return jsonify(result), 500
                
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': 'Invalid days parameter'
            }), 400
        except Exception as e:
            logging.error(f"Error getting risk assessment: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    @firebase_auth_required
    def get_personalized_recommendations():
        """
        Get personalized recommendations based on risk assessment
        
        Returns:
        - JSON response with risk assessment and personalized recommendations
        """
        try:
            user_id = get_current_user_id()
            
            result = FoodTrackingService.get_personalized_recommendations(user_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': 'Recommendations generated successfully',
                    'data': {
                        'risk_assessment': result['risk_assessment'],
                        'recommendations': result['recommendations']
                    }
                }), 200
            else:
                return jsonify(result), 500
                
        except Exception as e:
            logging.error(f"Error getting recommendations: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @staticmethod
    @firebase_auth_required
    def get_daily_log_analysis():
        """
        Get analysis of daily food logs
        
        Query parameters:
        - days: Number of days to analyze (default: 7)
        
        Returns:
        - JSON response with daily log analysis
        """
        try:
            user_id = get_current_user_id()
            
            # Get query parameters
            days = int(request.args.get('days', 7))
            
            # Validate days parameter
            if days < 1 or days > 90:
                return jsonify({
                    'success': False,
                    'error': 'Days parameter must be between 1 and 90'
                }), 400
            
            result = FoodTrackingService.calculate_daily_log_risk(user_id, days)
            
            if result['success']:
                response_data = {
                    'success': True,
                    'message': 'Daily log analysis completed successfully',
                    'data': {
                        'daily_risk_score': result['daily_risk_score'],
                        'analysis': result.get('analysis', {})
                    }
                }
                
                # Include warning if present
                if result.get('warning'):
                    response_data['data']['warning'] = result['warning']
                
                return jsonify(response_data), 200
            else:
                return jsonify(result), 500
                
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': 'Invalid days parameter'
            }), 400
        except Exception as e:
            logging.error(f"Error analyzing daily logs: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @staticmethod
    @firebase_auth_required
    def get_detailed_assessment_with_explanations():
        """
        Get comprehensive assessment with detailed explanations for frontend display
        
        Returns:
        - Baseline breakdown with explanations
        - Daily log analysis with nutrient explanations
        - Personalized, actionable recommendations
        - Overall risk explanation
        """
        try:
            user_id = get_current_user_id()
            days = int(request.args.get('days', 7))
            
            # Get comprehensive risk assessment
            risk_result = FoodTrackingService.calculate_comprehensive_risk(user_id, days)
            
            if not risk_result['success']:
                return jsonify(risk_result), 500
            
            # Get baseline data with contributions
            baseline_result = FoodBaselineAssessment.get_user_baseline(user_id)
            baseline_explanations = []
            
            if baseline_result['success'] and baseline_result.get('baseline'):
                contributions = baseline_result['baseline'].get('question_contributions', {})
                responses = baseline_result['baseline'].get('responses', {})
                
                # Sort by contribution (highest first)
                sorted_contributions = sorted(
                    contributions.items(),
                    key=lambda x: x[1]['contribution_percent'],
                    reverse=True
                )
                
                # Generate explanations for top contributors
                for question_key, contrib_data in sorted_contributions[:10]:  # Top 10
                    explanation = FoodExplanation.get_baseline_question_explanation(
                        question_key,
                        contrib_data['response'],
                        contrib_data['contribution_percent']
                    )
                    if explanation:
                        baseline_explanations.append(explanation)
            
            # Get nutrient explanations from daily log
            nutrient_explanations = []
            daily_analysis = risk_result.get('breakdown', {}).get('daily_analysis', {})
            daily_averages = daily_analysis.get('daily_averages', {})
            
            if daily_averages:
                thresholds = FoodTrackingService.DAILY_THRESHOLDS
                
                # Check each tracked nutrient
                for nutrient_key, threshold_data in thresholds.items():
                    avg_value = daily_averages.get(nutrient_key, 0)
                    
                    # Determine status
                    if 'optimal_min' in threshold_data and 'optimal_max' in threshold_data:
                        if avg_value < threshold_data['optimal_min']:
                            status = 'low'
                        elif avg_value > threshold_data['optimal_max']:
                            status = 'high'
                        else:
                            status = 'optimal'
                    elif 'optimal_min' in threshold_data:
                        status = 'optimal' if avg_value >= threshold_data['optimal_min'] else 'low'
                    elif 'optimal_max' in threshold_data:
                        high_risk = threshold_data.get('high_risk', threshold_data['optimal_max'] * 1.5)
                        if avg_value <= threshold_data['optimal_max']:
                            status = 'optimal'
                        elif avg_value <= high_risk:
                            status = 'moderate'
                        else:
                            status = 'high'
                    else:
                        status = 'unknown'
                    
                    explanation = FoodExplanation.get_nutrient_explanation(
                        nutrient_key,
                        avg_value,
                        status
                    )
                    if explanation:
                        nutrient_explanations.append(explanation)
            
            # Get overall risk category explanation
            risk_category_exp = FoodExplanation.get_risk_category_explanation(
                risk_result['comprehensive_risk_score']
            )
            
            # Get recommendations (already personalized)
            recommendations_result = FoodTrackingService.get_personalized_recommendations(user_id)
            recommendations = recommendations_result.get('recommendations', []) if recommendations_result['success'] else []
            
            return jsonify({
                'success': True,
                'message': 'Detailed assessment with explanations generated successfully',
                'data': {
                    'overall_risk': {
                        'score': risk_result['comprehensive_risk_score'],
                        'category': risk_result['risk_category'],
                        'message': risk_result['risk_message'],
                        'explanation': risk_category_exp
                    },
                    'baseline_assessment': {
                        'score': risk_result['breakdown']['baseline_risk'],
                        'weight_in_overall': 40,
                        'top_contributors': baseline_explanations
                    },
                    'daily_log_assessment': {
                        'score': risk_result['breakdown']['daily_log_risk'],
                        'weight_in_overall': 60,
                        'data_quality': risk_result.get('data_quality', 'good'),
                        'nutrient_analysis': nutrient_explanations,
                        'analysis_period_days': days,
                        'total_meals_logged': daily_analysis.get('total_meals', 0),
                        'meals_per_day': daily_analysis.get('meals_per_day', 0)
                    },
                    'recommendations': recommendations,
                    'warning': risk_result.get('warning')
                }
            }), 200
            
        except Exception as e:
            logging.error(f"Error getting detailed assessment: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
