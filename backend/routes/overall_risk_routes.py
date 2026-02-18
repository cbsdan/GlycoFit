"""
Overall Risk Assessment Routes

Routes for comprehensive diabetes risk assessment endpoints.
"""

from flask import Blueprint
from controllers import overall_risk_controller

overall_risk_bp = Blueprint('overall_risk', __name__)

# Overall risk assessment endpoints
overall_risk_bp.route('/overall', methods=['GET'])(overall_risk_controller.get_overall_assessment)
overall_risk_bp.route('/overall/refresh', methods=['POST'])(overall_risk_controller.refresh_overall_assessment)
overall_risk_bp.route('/overall/history', methods=['GET'])(overall_risk_controller.get_assessment_history)
overall_risk_bp.route('/overall/components', methods=['GET'])(overall_risk_controller.get_component_scores)
overall_risk_bp.route('/overall/factors', methods=['GET'])(overall_risk_controller.get_risk_factors)
overall_risk_bp.route('/overall/check', methods=['GET'])(overall_risk_controller.check_assessment_exists)
