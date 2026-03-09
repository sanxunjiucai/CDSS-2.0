"""辅助输入服务"""
from backend.data.mock_data import MOCK_SYMPTOMS, MOCK_SIGNS

class InputService:
    @staticmethod
    def parse_chief_complaint(text: str):
        return {
            "parsed_symptoms": MOCK_SYMPTOMS[:3],
            "parsed_signs": MOCK_SIGNS[:2],
            "structured_data": {"symptoms": MOCK_SYMPTOMS, "signs": MOCK_SIGNS}
        }

    @staticmethod
    def get_common_symptom_tags():
        return MOCK_SYMPTOMS

    @staticmethod
    def get_common_sign_tags():
        return MOCK_SIGNS
