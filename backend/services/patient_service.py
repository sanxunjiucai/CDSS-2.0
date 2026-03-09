"""患者上下文服务"""
from backend.data.mock_data import MOCK_PATIENT

class PatientService:
    @staticmethod
    def get_patient_context(patient_id: str):
        return MOCK_PATIENT
