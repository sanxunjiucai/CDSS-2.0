"""辅助诊断服务"""
from backend.tools.diagnosis_engine import score_diagnoses
from backend.data.repositories.knowledge_repo import get_all_diagnoses_kb


class DiagnosisService:
    @staticmethod
    def get_recommended_diagnoses(entities: list[dict]) -> list[dict]:
        """接收实体列表，调用诊断引擎打分，返回推荐诊断。"""
        kb = get_all_diagnoses_kb()
        if not kb:
            return []
        return score_diagnoses(entities, kb)

    @staticmethod
    def get_recommended_diagnoses_from_text(symptoms: list, signs: list) -> list[dict]:
        """旧版兼容：从症状/体征字符串列表生成实体后推荐"""
        entities = (
            [{"text": s, "category": "症状", "confirmed": True} for s in symptoms] +
            [{"text": s, "category": "体征", "confirmed": True} for s in signs]
        )
        kb = get_all_diagnoses_kb()
        return score_diagnoses(entities, kb)
