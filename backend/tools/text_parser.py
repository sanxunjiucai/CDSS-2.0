"""
文本解析引擎
基于关键词词典做命名实体识别，从主诉/现病史/既往史中提取：
症状 / 体征 / 疾病 / 检查 / 风险
"""
import re
from dataclasses import dataclass, field

# ══════════════════════════════════════════════════════
# 词典定义
# ══════════════════════════════════════════════════════

SYMPTOM_DICT = [
    "胸闷", "胸痛", "气短", "呼吸困难", "心悸", "心慌", "乏力", "头晕", "头痛",
    "恶心", "呕吐", "腹痛", "下肢水肿", "下肢浮肿", "端坐呼吸", "夜间阵发性呼吸困难",
    "多饮", "多尿", "多食", "体重减轻", "发热", "咳嗽", "咳痰", "咯血",
    "出汗", "盗汗", "食欲减退", "失眠", "晕厥", "黑矇", "视物模糊",
]

SIGN_DICT = [
    "血压升高", "血压偏低", "心率增快", "心率减慢", "心律不齐",
    "ST段压低", "ST段抬高", "ST改变", "心电图异常", "双肺湿啰音",
    "颈静脉怒张", "下肢凹陷性水肿", "脉搏不整", "收缩压",
    "舒张压", "心音减弱", "心脏杂音", "肝颈回流征阳性",
]

DISEASE_DICT = [
    "高血压", "糖尿病", "冠心病", "心绞痛", "心肌梗死", "心律失常", "房颤",
    "心力衰竭", "高脂血症", "高血脂", "脑梗死", "脑出血", "脑卒中",
    "慢阻肺", "哮喘", "肾病", "肾功能不全", "甲亢", "甲减",
    "痛风", "骨质疏松", "贫血", "肿瘤", "癌症",
]

TEST_DICT = [
    "心电图", "心脏超声", "冠脉CTA", "冠脉造影", "胸部X线", "胸片",
    "血常规", "尿常规", "肾功能", "肝功能", "血糖", "血脂", "血钾",
    "肌钙蛋白", "心肌酶", "BNP", "D-二聚体", "HbA1c",
    "冠脉狭窄", "冠脉病变", "心脏彩超",
]

RISK_DICT = [
    "青霉素过敏", "磺胺过敏", "碘过敏", "造影剂过敏", "药物过敏",
    "吸烟", "饮酒", "肥胖", "家族史", "心血管高危",
    "血糖控制不佳", "血压控制不佳", "出血风险", "跌倒风险",
]

CATEGORY_DICTS = {
    "症状": SYMPTOM_DICT,
    "体征": SIGN_DICT,
    "疾病": DISEASE_DICT,
    "检查": TEST_DICT,
    "风险": RISK_DICT,
}

# 文字 → source 映射（段落识别）
SOURCE_PATTERNS = [
    (re.compile(r"(主诉|胸闷|气短|心悸|头晕|乏力)"), "主诉"),
    (re.compile(r"(现病史|活动后|休息|加重|缓解|伴)"), "现病史"),
    (re.compile(r"(既往|过去|史|年前|曾经|青霉素|过敏)"), "既往史"),
]


# ══════════════════════════════════════════════════════
# 核心函数
# ══════════════════════════════════════════════════════

@dataclass
class Entity:
    id: str
    text: str
    category: str       # 症状/体征/疾病/检查/风险
    source: str         # 主诉/现病史/既往史/补充
    confirmed: bool = False


def _guess_source(text: str, context: str) -> str:
    """根据关键词猜测实体所属段落"""
    for pattern, source in SOURCE_PATTERNS:
        if pattern.search(context):
            return source
    return "现病史"


def extract_entities(
    chief_complaint: str = "",
    present_illness: str = "",
    past_history: str = "",
) -> list[dict]:
    """
    从三段文本中提取命名实体，去重，返回 entity dict 列表。
    既往史中的疾病/过敏风险默认 confirmed=True。
    """
    seen: set[str] = set()
    entities: list[Entity] = []
    counter = 0

    segments = [
        (chief_complaint, "主诉"),
        (present_illness, "现病史"),
        (past_history,    "既往史"),
    ]

    for text, source in segments:
        if not text:
            continue
        for category, word_list in CATEGORY_DICTS.items():
            for word in word_list:
                if word in text and word not in seen:
                    seen.add(word)
                    counter += 1
                    confirmed = source == "既往史" and category in ("疾病", "风险")
                    entities.append(Entity(
                        id=f"e{counter}",
                        text=word,
                        category=category,
                        source=source,
                        confirmed=confirmed,
                    ))

    # 转为 dict
    return [
        {
            "id": e.id,
            "text": e.text,
            "category": e.category,
            "source": e.source,
            "confirmed": e.confirmed,
        }
        for e in entities
    ]


def get_symptom_tags() -> list[str]:
    return SYMPTOM_DICT


def get_sign_tags() -> list[str]:
    return SIGN_DICT
