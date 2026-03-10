"""辅助输入服务"""
from backend.tools.text_parser import extract_entities, get_symptom_tags, get_sign_tags


class InputService:
    @staticmethod
    def parse_chief_complaint(
        chief_complaint: str = "",
        present_illness: str = "",
        past_history: str = "",
    ) -> dict:
        entities = extract_entities(chief_complaint, present_illness, past_history)
        return {"entities": entities}

    @staticmethod
    def get_common_symptom_tags() -> list[str]:
        return get_symptom_tags()

    @staticmethod
    def get_common_sign_tags() -> list[str]:
        return get_sign_tags()
