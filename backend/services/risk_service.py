"""风险评估服务"""
from backend.data.mock_data import MOCK_RISK

class RiskService:
    @staticmethod
    def assess_risk(patient_context: dict, diagnosis: str):
        return MOCK_RISK

    @staticmethod
    def get_audit_alerts(diagnosis: str, treatment: dict):
        return [
            {"level": "warning", "message": "患者有青霉素过敏史，请注意用药"},
            {"level": "info", "message": "建议完善心肌酶检查"}
        ]
