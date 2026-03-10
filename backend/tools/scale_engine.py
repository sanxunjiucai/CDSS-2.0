"""
量表评分引擎
实现 NYHA / Barthel / Morse 三个临床量表
所有函数为纯函数，无副作用
"""


# ══════════════════════════════════════════════════════
# NYHA 心功能分级
# ══════════════════════════════════════════════════════

def calc_nyha(entities: list[dict], activity_limit: str = "moderate") -> dict:
    """
    基于实体和活动受限程度推断 NYHA 分级
    activity_limit: 'rest'|'minimal'|'moderate'|'none'
    """
    symptom_texts = {e["text"] for e in entities if e["category"] == "症状"}

    # 规则：有静息时症状 → IV；轻微活动 → III；中等活动 → II；无限制 → I
    has_dyspnea  = "气短" in symptom_texts or "呼吸困难" in symptom_texts
    has_fatigue  = "乏力" in symptom_texts
    has_pnd      = "夜间阵发性呼吸困难" in symptom_texts or "端坐呼吸" in symptom_texts

    if has_pnd:
        grade, label = "IV", "IV 级"
        desc = "休息时即有症状，任何体力活动均可加重，丧失劳动能力。"
        level = "critical"
    elif activity_limit == "minimal" or (has_dyspnea and has_fatigue):
        grade, label = "III", "III 级"
        desc = "轻度体力活动即出现症状（气短/乏力），休息后缓解。显著影响日常活动。"
        level = "high"
    elif activity_limit == "moderate" or has_dyspnea:
        grade, label = "II", "II 级"
        desc = "中度体力活动（爬楼梯、快走）时出现症状，休息后消失。轻微限制日常活动。"
        level = "moderate"
    else:
        grade, label = "I", "I 级"
        desc = "有心脏病但体力活动不受限，日常活动不引起不适。"
        level = "low"

    basis = []
    if has_dyspnea:  basis.append("气短/呼吸困难（主诉/现病史）")
    if has_fatigue:  basis.append("乏力（现病史）")
    if has_pnd:      basis.append("夜间阵发性呼吸困难/端坐呼吸（现病史）")
    if activity_limit == "minimal": basis.append("轻微活动即诱发症状")

    return {
        "id": "S001",
        "name": "NYHA 心功能分级",
        "score": grade,
        "level": level,
        "levelLabel": label,
        "description": desc,
        "basis": basis or ["根据当前症状综合评估"],
    }


# ══════════════════════════════════════════════════════
# Barthel 日常活动指数
# ══════════════════════════════════════════════════════

_BARTHEL_ITEMS = [
    ("进食",     10),
    ("修饰",      5),
    ("洗澡",      5),
    ("穿衣",     10),
    ("如厕",     10),
    ("大便控制", 10),
    ("小便控制", 10),
    ("床椅转移", 15),
    ("平地行走", 15),
    ("上下楼梯", 10),
]


def calc_barthel(patient: dict, entities: list[dict]) -> dict:
    """
    基于患者年龄和症状对 Barthel 指数做粗略估算
    实际临床需逐项评估，此处为自动化近似
    """
    age   = patient.get("age", 50)
    texts = {e["text"] for e in entities}

    # 基础扣分规则
    deductions = 0
    basis = []

    if "气短" in texts or "呼吸困难" in texts:
        deductions += 15
        basis.append("气短影响活动耐量")
    if "乏力" in texts:
        deductions += 10
        basis.append("乏力（现病史）")
    if "下肢水肿" in texts or "下肢浮肿" in texts:
        deductions += 10
        basis.append("下肢水肿影响行走")
    if age >= 70:
        deductions += 10
        basis.append(f"年龄 {age} 岁（高龄因素）")
    elif age >= 60:
        deductions += 5
        basis.append(f"年龄 {age} 岁")
    if "心力衰竭" in texts:
        deductions += 15
        basis.append("合并心功能不全")

    score = max(0, 100 - deductions)

    if score >= 95:
        level, label = "normal",   "完全自理"
    elif score >= 60:
        level, label = "moderate", "中度依赖"
    elif score >= 40:
        level, label = "high",     "重度依赖"
    else:
        level, label = "critical", "完全依赖"

    desc = {
        "normal":   "日常活动完全自理，无需协助。",
        "moderate": "日常生活部分依赖，需要辅助完成洗浴、穿衣等活动。",
        "high":     "大部分活动需要他人协助，自理能力严重受限。",
        "critical": "完全依赖他人照护，无法完成任何日常活动。",
    }[level]

    return {
        "id": "S002",
        "name": "Barthel 日常活动指数",
        "score": score,
        "max": 100,
        "level": level,
        "levelLabel": label,
        "description": desc,
        "basis": basis or ["根据当前症状综合评估"],
    }


# ══════════════════════════════════════════════════════
# Morse 跌倒风险评估
# ══════════════════════════════════════════════════════

def calc_morse(patient: dict, entities: list[dict], medications: list[str] | None = None) -> dict:
    """
    Morse 跌倒风险量表（6 因子）
    """
    age       = patient.get("age", 50)
    chronic   = patient.get("chronic_diseases", [])
    texts     = {e["text"] for e in entities}
    meds      = medications or []

    score = 0
    factors = []

    # ① 跌倒史（简化：无法自动判断，默认无）
    factors.append({"name": "跌倒史", "value": "无", "pts": 0})

    # ② 继发性诊断（合并症 ≥ 2）
    multi_dx = len(chronic) >= 2
    pts = 15 if multi_dx else 0
    score += pts
    factors.append({"name": "继发性诊断（合并症≥2）",
                    "value": "是" if multi_dx else "否", "pts": pts})

    # ③ 行走辅助（有心血管症状默认需辅助设备）
    needs_aid = "气短" in texts or "乏力" in texts or "头晕" in texts
    pts = 15 if needs_aid else 0
    score += pts
    factors.append({"name": "行走辅助工具",
                    "value": "需要" if needs_aid else "不需要", "pts": pts})

    # ④ 静脉输液/导管
    pts = 20  # 住院默认有静脉通路
    score += pts
    factors.append({"name": "静脉输液/导管", "value": "有（住院患者）", "pts": pts})

    # ⑤ 步态（有眩晕/气短影响步态）
    gait_abnormal = "头晕" in texts or "黑矇" in texts or "气短" in texts
    pts = 10 if gait_abnormal else 0
    score += pts
    factors.append({"name": "步态", "value": "异常" if gait_abnormal else "正常", "pts": pts})

    # ⑥ 认知状态（年龄 > 70 适当加分）
    cognition_pts = 5 if age >= 70 else 0
    score += cognition_pts
    factors.append({"name": "认知状态/年龄",
                    "value": f"{age} 岁" + ("（高龄）" if age >= 70 else ""), "pts": cognition_pts})

    # β阻滞剂额外风险
    beta_blocker = any(m in str(meds) for m in ["比索洛尔", "美托洛尔", "β阻滞剂"])
    if beta_blocker:
        score += 5

    if score < 25:
        level, label = "low",      "低风险"
        desc = "维持常规护理措施。"
    elif score < 45:
        level, label = "moderate", "中等风险"
        desc = "实施标准跌倒预防措施，告知患者注意安全。"
    else:
        level, label = "high",     "高风险"
        desc = "高跌倒风险，需加强防跌倒措施、床旁护理及患者教育。"

    basis = [f["name"] + "：" + f["value"] for f in factors if f["pts"] > 0]

    return {
        "id": "S003",
        "name": "Morse 跌倒风险",
        "score": score,
        "max": 125,
        "level": level,
        "levelLabel": label,
        "description": desc,
        "basis": basis or ["根据住院患者基线评估"],
    }


# ══════════════════════════════════════════════════════
# 综合调用
# ══════════════════════════════════════════════════════

def calc_all_scales(patient: dict, entities: list[dict]) -> list[dict]:
    """返回所有量表评分结果列表"""
    nyha    = calc_nyha(entities)
    barthel = calc_barthel(patient, entities)
    morse   = calc_morse(patient, entities)
    return [nyha, barthel, morse]
