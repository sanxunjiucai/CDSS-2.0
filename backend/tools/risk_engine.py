"""
风险公式引擎
实现 GRACE / TIMI / PRECISE-DAPT 三个临床评分公式
所有函数为纯函数，无副作用
"""
import math


# ══════════════════════════════════════════════════════
# 辅助：风险分级
# ══════════════════════════════════════════════════════

def _grace_level(score: int) -> tuple[str, str]:
    if score < 109:
        return "low",     "低危（院内死亡率 < 1%）"
    elif score <= 140:
        return "moderate", "中危（院内死亡率 1–3%）"
    else:
        return "high",    "高危（院内死亡率 3–8%），建议 24h 内冠脉造影"


def _timi_level(score: int) -> tuple[str, str]:
    if score <= 2:
        return "low",     "低危（14 天 MACE 风险 < 5%）"
    elif score <= 4:
        return "moderate", "中危（14 天 MACE 风险约 13–20%）"
    else:
        return "high",    "高危（14 天 MACE 风险 > 26%），积极药物治疗 + 早期评估"


def _precise_level(score: int) -> tuple[str, str]:
    if score < 17:
        return "low",  "出血低危，标准 DAPT 12 个月"
    elif score < 25:
        return "moderate", "出血中危，标准 DAPT 可接受"
    else:
        return "high", "出血高危（≥25 分），建议缩短 DAPT 至 3–6 个月"


# ══════════════════════════════════════════════════════
# GRACE 2.0 评分
# ══════════════════════════════════════════════════════
# 参数来源：GRACE 2.0 nomogram（近似分段线性实现）

def calc_grace(
    age: int,
    heart_rate: int | None      = None,
    sbp: int | None             = None,
    creatinine: float | None    = None,   # μmol/L
    killip_class: int           = 1,      # 1-4
    cardiac_arrest: bool        = False,
    st_deviation: bool          = True,
    elevated_troponin: bool | None = None,  # None=待查
) -> dict:
    """
    GRACE 2.0 近似评分
    返回 {score, max, level, description, factors[]}
    """
    score = 0
    factors = []

    # 年龄
    age_pts = _grace_age_pts(age)
    score += age_pts
    factors.append({"name": "年龄", "value": f"{age} 岁", "pts": age_pts,
                    "contribution": "high" if age_pts > 30 else "medium"})

    # 心率
    hr_pts = 0
    hr_val = f"{heart_rate} 次/分" if heart_rate else "待查"
    if heart_rate:
        hr_pts = _grace_hr_pts(heart_rate)
    score += hr_pts
    factors.append({"name": "心率", "value": hr_val, "pts": hr_pts,
                    "contribution": "medium" if hr_pts > 10 else "low"})

    # 收缩压
    sbp_pts = 0
    sbp_val = f"{sbp} mmHg" if sbp else "待查"
    if sbp:
        sbp_pts = _grace_sbp_pts(sbp)
    score += sbp_pts
    factors.append({"name": "收缩压", "value": sbp_val, "pts": sbp_pts,
                    "contribution": "high" if sbp_pts > 20 else "medium"})

    # 肌酐
    cr_pts = 0
    cr_val = f"{creatinine} μmol/L" if creatinine else "待查"
    if creatinine:
        cr_pts = _grace_creatinine_pts(creatinine)
    score += cr_pts
    factors.append({"name": "肌酐", "value": cr_val, "pts": cr_pts,
                    "contribution": "medium" if cr_pts > 10 else "low"})

    # Killip 分级
    killip_pts = {1: 0, 2: 20, 3: 39, 4: 59}.get(killip_class, 0)
    score += killip_pts
    factors.append({"name": "Killip 分级", "value": f"Killip {killip_class}",
                    "pts": killip_pts, "contribution": "high" if killip_pts > 0 else "low"})

    # 心脏骤停史
    arrest_pts = 43 if cardiac_arrest else 0
    score += arrest_pts
    factors.append({"name": "心脏骤停史", "value": "有" if cardiac_arrest else "无",
                    "pts": arrest_pts, "contribution": "high" if cardiac_arrest else "low"})

    # ST 偏移
    st_pts = 28 if st_deviation else 0
    score += st_pts
    factors.append({"name": "ST 偏移", "value": "有" if st_deviation else "无",
                    "pts": st_pts, "contribution": "high" if st_deviation else "low"})

    # 肌钙蛋白
    tn_pts = 0
    tn_val = "待查" if elevated_troponin is None else ("升高" if elevated_troponin else "正常")
    if elevated_troponin:
        tn_pts = 14
    score += tn_pts
    factors.append({"name": "肌钙蛋白", "value": tn_val, "pts": tn_pts,
                    "contribution": "high" if tn_pts > 0 else "medium"})

    level, description = _grace_level(score)
    return {
        "name": "GRACE 评分（急性冠脉综合征）",
        "score": score,
        "max": 263,
        "level": level,
        "description": description,
        "factors": factors,
    }


def _grace_age_pts(age: int) -> int:
    if age < 30: return 0
    elif age < 40: return 8
    elif age < 50: return 25
    elif age < 60: return 41
    elif age < 70: return 58
    elif age < 80: return 75
    else: return 91


def _grace_hr_pts(hr: int) -> int:
    if hr < 50: return 0
    elif hr < 70: return 3
    elif hr < 90: return 9
    elif hr < 110: return 15
    elif hr < 150: return 24
    elif hr < 200: return 38
    else: return 46


def _grace_sbp_pts(sbp: int) -> int:
    if sbp < 80: return 58
    elif sbp < 100: return 53
    elif sbp < 120: return 43
    elif sbp < 140: return 34
    elif sbp < 160: return 24
    elif sbp < 200: return 10
    else: return 0


def _grace_creatinine_pts(cr: float) -> int:
    if cr < 35.4: return 1
    elif cr < 70.7: return 4
    elif cr < 106.1: return 7
    elif cr < 141.4: return 10
    elif cr < 176.8: return 13
    elif cr < 353.6: return 21
    else: return 28


# ══════════════════════════════════════════════════════
# TIMI 评分（UA/NSTEMI）
# ══════════════════════════════════════════════════════

def calc_timi(
    age_ge65: bool,
    risk_factors_ge3: bool,         # ≥3个危险因素：高血压/糖尿病/高血脂/吸烟/家族史
    known_cad: bool,                # 既知冠脉狭窄 ≥ 50%
    st_deviation: bool,
    angina_events_ge2: bool,        # 24h 内心绞痛 ≥ 2 次
    aspirin_use: bool,              # 近 7 天阿司匹林使用史（矛盾指标，有反加分）
    elevated_troponin: bool | None = None,
) -> dict:
    score = 0
    factors = []

    items = [
        ("年龄 ≥ 65 岁",         age_ge65,            "是" if age_ge65 else "否"),
        ("危险因素 ≥ 3 个",      risk_factors_ge3,    "是" if risk_factors_ge3 else "否"),
        ("既往冠脉狭窄 ≥ 50%",  known_cad,           "是" if known_cad else "未知"),
        ("心电图 ST 改变",       st_deviation,        "是" if st_deviation else "否"),
        ("24h 内心绞痛 ≥ 2 次", angina_events_ge2,   "是" if angina_events_ge2 else "否"),
        ("近 7 天阿司匹林使用", aspirin_use,         "是" if aspirin_use else "否"),
    ]
    for name, flag, val in items:
        pts = 1 if flag else 0
        score += pts
        factors.append({"name": name, "value": val, "pts": pts,
                        "contribution": "high" if pts else "low"})

    tn_pts = 0
    tn_val = "待查" if elevated_troponin is None else ("升高" if elevated_troponin else "正常")
    if elevated_troponin:
        tn_pts = 1
    score += tn_pts
    factors.append({"name": "升高的心肌标志物", "value": tn_val, "pts": tn_pts,
                    "contribution": "high" if tn_pts else "medium"})

    level, description = _timi_level(score)
    return {
        "name": "TIMI 评分（不稳定型心绞痛）",
        "score": score,
        "max": 7,
        "level": level,
        "description": description,
        "factors": factors,
    }


# ══════════════════════════════════════════════════════
# PRECISE-DAPT 评分
# ══════════════════════════════════════════════════════

def calc_precise_dapt(
    age: int,
    creatinine_clearance: float | None = None,  # ml/min，None=待查
    hemoglobin: float | None           = None,  # g/dL，None=待查
    wbc: float | None                  = None,  # ×10⁹/L，None=待查
    prior_bleeding: bool               = False,
) -> dict:
    """
    PRECISE-DAPT 近似评分（原始公式为连续变量，此处做分档近似）
    """
    score = 0
    factors = []

    # 年龄分档（粗算）
    age_pts = max(0, int((age - 30) * 0.5))
    age_pts = min(age_pts, 20)
    score += age_pts
    factors.append({"name": "年龄", "value": f"{age} 岁", "pts": age_pts,
                    "contribution": "high" if age > 60 else "medium"})

    # 肌酐清除率（越低风险越高）
    ccr_pts = 0
    ccr_val = f"{creatinine_clearance:.0f} ml/min" if creatinine_clearance else "待查"
    if creatinine_clearance:
        if creatinine_clearance < 30:   ccr_pts = 15
        elif creatinine_clearance < 60: ccr_pts = 8
        elif creatinine_clearance < 90: ccr_pts = 3
    score += ccr_pts
    factors.append({"name": "肌酐清除率", "value": ccr_val, "pts": ccr_pts,
                    "contribution": "medium" if ccr_pts > 3 else "low"})

    # 血红蛋白（越低风险越高）
    hb_pts = 0
    hb_val = f"{hemoglobin} g/dL" if hemoglobin else "待查"
    if hemoglobin:
        if hemoglobin < 11:   hb_pts = 10
        elif hemoglobin < 13: hb_pts = 5
        elif hemoglobin < 14: hb_pts = 2
    score += hb_pts
    factors.append({"name": "血红蛋白", "value": hb_val, "pts": hb_pts,
                    "contribution": "medium" if hb_pts > 2 else "low"})

    # WBC
    wbc_pts = 0
    wbc_val = f"{wbc} ×10⁹/L" if wbc else "待查"
    if wbc and wbc > 10:
        wbc_pts = 3
    score += wbc_pts
    factors.append({"name": "白细胞计数", "value": wbc_val, "pts": wbc_pts,
                    "contribution": "low"})

    # 既往出血史
    bleed_pts = 10 if prior_bleeding else 0
    score += bleed_pts
    factors.append({"name": "既往自发出血史", "value": "有" if prior_bleeding else "无",
                    "pts": bleed_pts, "contribution": "high" if prior_bleeding else "low"})

    level, description = _precise_level(score)
    return {
        "name": "PRECISE-DAPT（双联抗血小板出血风险）",
        "score": score,
        "max": 100,
        "level": level,
        "description": description,
        "factors": factors,
    }


# ══════════════════════════════════════════════════════
# 综合调用
# ══════════════════════════════════════════════════════

def calc_all_risk_scores(patient: dict, lab_values: dict | None = None) -> list[dict]:
    """
    根据患者信息计算所有风险评分
    lab_values: 可选的检验值，如 {"heart_rate": 88, "sbp": 158, "creatinine": None}
    """
    lab = lab_values or {}
    age = patient.get("age", 50)

    chronic = patient.get("chronic_diseases", [])
    allergies = patient.get("allergies", [])

    risk_factors_ge3 = len(chronic) >= 2  # 简化判断

    grace = calc_grace(
        age=age,
        heart_rate=lab.get("heart_rate", 88),
        sbp=lab.get("sbp", 158),
        creatinine=lab.get("creatinine"),
        st_deviation=lab.get("st_deviation", True),
        elevated_troponin=lab.get("elevated_troponin"),
    )

    timi = calc_timi(
        age_ge65=(age >= 65),
        risk_factors_ge3=risk_factors_ge3,
        known_cad=("冠心病" in chronic or "冠脉狭窄" in str(patient)),
        st_deviation=lab.get("st_deviation", True),
        angina_events_ge2=True,  # 主诉多次发作
        aspirin_use=False,
        elevated_troponin=lab.get("elevated_troponin"),
    )

    precise = calc_precise_dapt(
        age=age,
        creatinine_clearance=lab.get("creatinine_clearance"),
        hemoglobin=lab.get("hemoglobin"),
        wbc=lab.get("wbc"),
        prior_bleeding=False,
    )

    return [grace, timi, precise]
