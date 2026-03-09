"""治疗服务"""
from backend.data.mock_data import MOCK_COMMON_TREATMENTS, MOCK_PERSONALIZED_TREATMENTS

class TreatmentService:
    @staticmethod
    def get_common_treatment_plans(diagnosis: str):
        return MOCK_COMMON_TREATMENTS

    @staticmethod
    def get_personalized_treatment_plans(diagnosis: str, patient_context: dict):
        return MOCK_PERSONALIZED_TREATMENTS
