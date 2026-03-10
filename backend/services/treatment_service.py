"""治疗服务"""
from backend.data.repositories.knowledge_repo import get_treatments, get_all_treatments


class TreatmentService:
    @staticmethod
    def get_common_treatment_plans(diagnosis: str) -> list[dict]:
        plans = get_treatments(diagnosis, "common")
        if not plans:
            plans = get_all_treatments("common")
        return plans

    @staticmethod
    def get_personalized_treatment_plans(diagnosis: str, patient_context: dict) -> list[dict]:
        plans = get_treatments(diagnosis, "personalized")
        if not plans:
            plans = get_all_treatments("personalized")

        # 禁忌过滤：移除含患者过敏物质的方案
        allergies = patient_context.get("allergies", [])
        if allergies:
            filtered = []
            for plan in plans:
                contraindications = plan.get("contraindications", [])
                conflict = any(
                    any(allergy in c for c in contraindications)
                    for allergy in allergies
                )
                plan["has_contraindication"] = conflict
                filtered.append(plan)
            return filtered
        return plans
