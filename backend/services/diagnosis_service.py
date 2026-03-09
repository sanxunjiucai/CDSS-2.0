"""辅助诊断服务"""
from backend.data.mock_data import MOCK_DIAGNOSES

class DiagnosisService:
    @staticmethod
    def get_recommended_diagnoses(symptoms: list, signs: list):
        return MOCK_DIAGNOSES

    @staticmethod
    def get_differential_diagnoses(primary_diagnosis: str):
        return [d for d in MOCK_DIAGNOSES if d["disease_name"] != primary_diagnosis]
