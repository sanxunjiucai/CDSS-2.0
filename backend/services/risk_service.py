"""风险评估服务"""
from backend.tools.risk_engine import calc_all_risk_scores
from backend.tools.scale_engine import calc_all_scales


_AUDIT_RULES = [
    {
        "id": "A001",
        "category": "药物安全",
        "level": "warning",
        "trigger_allergy": "青霉素",
        "title": "青霉素过敏史 — 头孢菌素类交叉过敏风险",
        "detail": "患者有明确青霉素过敏史。头孢菌素与青霉素存在约 2% 交叉过敏风险。如需抗感染治疗，须避免此类药物。",
        "related": ["青霉素", "头孢菌素"],
        "action": "如需抗感染，优先选用大环内酯类或喹诺酮类",
    },
    {
        "id": "A002",
        "category": "药物安全",
        "level": "caution",
        "trigger_drug_pair": ("氯吡格雷", "奥美拉唑"),
        "title": "氯吡格雷 + 奥美拉唑 — CYP2C19 代谢相互作用",
        "detail": "奥美拉唑是 CYP2C19 强抑制剂，可使氯吡格雷活性代谢产物浓度下降 40–50%，FDA 黑框警告。",
        "related": ["氯吡格雷", "奥美拉唑"],
        "action": "将奥美拉唑替换为泮托拉唑（CYP2C19 影响较小）",
    },
    {
        "id": "A003",
        "category": "临床预警",
        "level": "caution",
        "trigger_drug": "培哚普利",
        "trigger_chronic": "糖尿病",
        "title": "ACEI（培哚普利）+ 糖尿病 — 高钾风险",
        "detail": "ACEI 可抑制醛固酮分泌导致钾潴留，合并糖尿病患者风险更高。启药后 1–2 周必须复查血钾，>5.5 mmol/L 须立即调整。",
        "related": ["培哚普利", "血钾", "糖尿病"],
        "action": "启药后 2 周内复查电解质 + 肌酐",
    },
]


class RiskService:
    @staticmethod
    def assess_risk(patient_context: dict, diagnosis: str, lab_values: dict | None = None) -> dict:
        scores = calc_all_risk_scores(patient_context, lab_values or {})
        return {
            "diagnosis": diagnosis,
            "risk_scores": scores,
            "overall_level": scores[0]["level"] if scores else "moderate",
        }

    @staticmethod
    def get_scale_results(patient_context: dict, entities: list[dict]) -> list[dict]:
        return calc_all_scales(patient_context, entities)

    @staticmethod
    def get_audit_alerts(diagnosis: str, treatment: dict, patient_context: dict) -> list[dict]:
        alerts = []
        allergies = patient_context.get("allergies", [])
        chronic   = patient_context.get("chronic_diseases", [])
        meds_str  = str(treatment)

        for rule in _AUDIT_RULES:
            triggered = False
            if "trigger_allergy" in rule:
                if rule["trigger_allergy"] in allergies:
                    triggered = True
            if "trigger_drug_pair" in rule:
                a, b = rule["trigger_drug_pair"]
                if a in meds_str and b in meds_str:
                    triggered = True
            if "trigger_drug" in rule and "trigger_chronic" in rule:
                if rule["trigger_drug"] in meds_str and rule["trigger_chronic"] in chronic:
                    triggered = True
            if triggered:
                alerts.append({k: v for k, v in rule.items()
                               if not k.startswith("trigger_")})
        return alerts
