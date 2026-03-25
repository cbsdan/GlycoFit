"""
Risk seeder — overall risk assessment for non-diagnosed users.
Delegates to ComprehensiveRiskService so the stored document always
matches the format produced by the real pipeline (same component
structure, weights, explanations, and recommendations).
"""


def seed_overall_risk_assessment(db, user_oid_str, config):
    """Seed overall risk assessment by running the real ComprehensiveRiskService."""
    from services.comprehensive_risk_service import ComprehensiveRiskService
    try:
        service = ComprehensiveRiskService()
        result = service.compute_overall_risk(user_oid_str)
        score = result.get('overall_risk_score', 'N/A')
        category = result.get('overall_risk_category', 'N/A')
        if isinstance(score, (int, float)):
            print(f"  [+] Overall risk assessment created: score={score:.1f}, level={category}")
        else:
            print(f"  [+] Overall risk assessment created: score={score}, level={category}")
        return result
    except Exception as e:
        print(f"  [!] Overall risk assessment failed (non-fatal): {e}")
        return None

