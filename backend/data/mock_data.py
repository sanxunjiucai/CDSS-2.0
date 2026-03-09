"""Mock数据"""

MOCK_PATIENT = {
    "patient_id": "P20260309001",
    "name": "张三",
    "gender": "男",
    "age": 58,
    "department": "心内科",
    "visit_id": "MZ20260309001",
    "chief_complaint": "胸闷气短3天，伴心悸",
    "chronic_diseases": ["高血压", "糖尿病"],
    "allergies": ["青霉素"],
    "risk_tags": ["心血管高危", "血糖控制不佳"]
}

MOCK_SYMPTOMS = ["胸闷", "气短", "心悸", "乏力", "头晕"]
MOCK_SIGNS = ["血压升高", "心率增快", "心律不齐"]

MOCK_DIAGNOSES = [
    {"disease_name": "冠心病-不稳定型心绞痛", "confidence": 0.85, "priority": 1, "reasoning": "典型胸痛症状+心电图ST段改变"},
    {"disease_name": "心律失常-房颤", "confidence": 0.72, "priority": 2, "reasoning": "心悸+心电图提示房颤"},
    {"disease_name": "心力衰竭", "confidence": 0.65, "priority": 3, "reasoning": "气短+既往高血压病史"}
]

MOCK_COMMON_TREATMENTS = [
    {
        "plan_id": "T001",
        "plan_name": "标准抗心绞痛方案",
        "description": "硝酸酯类+β受体阻滞剂+抗血小板",
        "medications": [
            {"name": "阿司匹林", "dose": "100mg qd", "route": "口服"},
            {"name": "美托洛尔", "dose": "25mg bid", "route": "口服"}
        ],
        "non_drug_treatments": ["休息", "吸氧", "心电监护"]
    }
]

MOCK_PERSONALIZED_TREATMENTS = [
    {
        "plan_id": "P001",
        "plan_name": "个体化调整方案",
        "description": "考虑糖尿病+青霉素过敏",
        "adjustments": ["避免使用青霉素类", "加强血糖监测"],
        "medications": [
            {"name": "阿司匹林", "dose": "100mg qd", "route": "口服"},
            {"name": "比索洛尔", "dose": "2.5mg qd", "route": "口服"}
        ]
    }
]

MOCK_TESTS = [
    {"test_id": "E001", "test_name": "心肌酶谱", "priority": "required", "reason": "排除心肌梗死", "sample_requirements": "空腹静脉血3ml"},
    {"test_id": "E002", "test_name": "肌钙蛋白", "priority": "required", "reason": "心肌损伤标志物", "sample_requirements": "静脉血2ml"},
    {"test_id": "E003", "test_name": "冠脉CTA", "priority": "recommended", "reason": "评估冠脉狭窄程度", "sample_requirements": "预约检查"}
]

MOCK_RISK = {
    "model_name": "Framingham心血管风险评分",
    "risk_score": 28.5,
    "risk_level": "高危",
    "future_risks": [
        {"disease": "急性心肌梗死", "probability": "15%", "timeframe": "10年"},
        {"disease": "脑卒中", "probability": "12%", "timeframe": "10年"}
    ],
    "interventions": ["强化降压", "强化降脂", "戒烟", "控制血糖"]
}

SEARCH_CATEGORIES = ["综合", "疾病", "药品", "检查", "症状体征", "指南", "动态文献", "案例文献", "三基", "公式"]

MOCK_SEARCH_RESULTS = {
    "冠心病": [
        {"title": "冠心病诊断与治疗指南(2024)", "type": "指南", "summary": "最新版冠心病诊疗规范"},
        {"title": "不稳定型心绞痛的药物治疗", "type": "疾病", "summary": "包括抗血小板、抗凝等治疗"}
    ]
}
