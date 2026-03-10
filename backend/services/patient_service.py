"""患者上下文服务"""
from backend.data.repositories.patient_repo import get_patient
from backend.data.mock_data import MOCK_PATIENT  # 保底 fallback


class PatientService:
    @staticmethod
    def get_patient_context(patient_id: str) -> dict:
        patient = get_patient(patient_id)
        if patient:
            return patient
        # DB 中没有该患者时，返回 mock fallback
        return MOCK_PATIENT
