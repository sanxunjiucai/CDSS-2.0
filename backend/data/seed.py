"""知识库种子数据导入（幂等：先清表再插入）"""
import json
from backend.data.database import get_conn, init_db

# ══════════════════════════════════════════════════════
# 患者种子数据（模拟 HIS 下发）
# ══════════════════════════════════════════════════════
PATIENTS = [
    {
        "patient_id": "P20260309001",
        "name": "张三",
        "gender": "男",
        "age": 58,
        "department": "心内科",
        "visit_id": "MZ20260309001",
        "chief_complaint": "胸闷气短 3 天，伴心悸",
        "present_illness": "活动后胸闷气短加重，休息后可缓解，伴乏力。",
        "past_history": "高血压 10 年，糖尿病 5 年，青霉素过敏。",
        "chronic_diseases": ["高血压", "糖尿病"],
        "allergies": ["青霉素"],
        "risk_tags": ["心血管高危", "血糖控制不佳"],
    }
]

# ══════════════════════════════════════════════════════
# 诊断知识库
# ══════════════════════════════════════════════════════
DIAGNOSES_KB = [
    {
        "disease_name": "冠心病 — 不稳定型心绞痛",
        "icd_code": "I20.0",
        "match_symptoms": ["胸闷", "胸痛", "气短", "心悸", "乏力"],
        "match_signs": ["ST段压低", "ST改变", "心电图异常", "血压升高"],
        "match_history": ["高血压", "糖尿病", "冠心病", "冠脉狭窄"],
        "base_confidence": 0.85,
        "reasoning_template": "典型缺血性胸痛症状，活动后加重休息缓解，叠加心血管危险因素",
        "tags": ["首选诊断", "需立即处理"],
    },
    {
        "disease_name": "心律失常 — 阵发性房颤",
        "icd_code": "I48.0",
        "match_symptoms": ["心悸", "乏力", "头晕", "胸闷"],
        "match_signs": ["心律不齐", "脉搏不整", "心率增快"],
        "match_history": ["高血压", "甲亢", "心脏病"],
        "base_confidence": 0.70,
        "reasoning_template": "心悸症状显著，合并心血管基础病史，需心电图评估是否存在阵发性房颤",
        "tags": ["需鉴别"],
    },
    {
        "disease_name": "心力衰竭",
        "icd_code": "I50.9",
        "match_symptoms": ["气短", "乏力", "下肢水肿", "端坐呼吸", "夜间阵发性呼吸困难"],
        "match_signs": ["双肺湿啰音", "颈静脉怒张", "下肢凹陷性水肿"],
        "match_history": ["高血压", "冠心病", "心肌病", "糖尿病"],
        "base_confidence": 0.60,
        "reasoning_template": "气短乏力症状合并心血管基础病史，需 BNP 及心脏超声鉴别",
        "tags": ["需鉴别"],
    },
    {
        "disease_name": "高血压急症",
        "icd_code": "I10",
        "match_symptoms": ["头痛", "头晕", "视物模糊", "恶心"],
        "match_signs": ["血压升高", "收缩压>180", "舒张压>120"],
        "match_history": ["高血压"],
        "base_confidence": 0.65,
        "reasoning_template": "血压显著升高，伴靶器官损伤症状",
        "tags": ["需紧急处理"],
    },
    {
        "disease_name": "2型糖尿病酮症酸中毒",
        "icd_code": "E11.1",
        "match_symptoms": ["恶心", "呕吐", "腹痛", "乏力", "多饮", "多尿"],
        "match_signs": ["血糖升高", "呼吸深大"],
        "match_history": ["糖尿病"],
        "base_confidence": 0.55,
        "reasoning_template": "糖尿病患者出现代谢紊乱症状，需急查血糖及酮体",
        "tags": ["需鉴别"],
    },
]

# ══════════════════════════════════════════════════════
# 治疗方案库
# ══════════════════════════════════════════════════════
TREATMENTS_KB = [
    # ── 通用方案 ──
    {
        "plan_id": "T001",
        "plan_type": "common",
        "disease_name": "冠心病 — 不稳定型心绞痛",
        "plan_name": "标准抗心绞痛方案",
        "description": "抗血小板 + 硝酸酯 + β阻滞剂 + 他汀，ACC/AHA 指南推荐一线方案",
        "medications": [
            {"name": "阿司匹林", "dose": "100mg qd", "route": "口服"},
            {"name": "氯吡格雷", "dose": "75mg qd", "route": "口服"},
            {"name": "硝酸异山梨酯", "dose": "10mg tid", "route": "口服"},
            {"name": "比索洛尔", "dose": "2.5mg qd", "route": "口服"},
            {"name": "阿托伐他汀", "dose": "20mg qn", "route": "口服"},
        ],
        "non_drug_treatments": ["卧床休息", "低流量吸氧（2-4 L/min）", "持续心电监护", "记录出入量"],
        "contraindications": [],
        "adjustments": [],
    },
    {
        "plan_id": "T002",
        "plan_type": "common",
        "disease_name": "心律失常 — 阵发性房颤",
        "plan_name": "房颤标准控制方案",
        "description": "心室率控制 + 抗凝，ESC 指南推荐",
        "medications": [
            {"name": "美托洛尔", "dose": "25mg bid", "route": "口服"},
            {"name": "利伐沙班", "dose": "20mg qd", "route": "口服（随餐）"},
        ],
        "non_drug_treatments": ["心电监护", "评估 CHA₂DS₂-VASc 评分"],
        "contraindications": [],
        "adjustments": [],
    },
    # ── 个性化方案 ──
    {
        "plan_id": "P001",
        "plan_type": "personalized",
        "disease_name": "冠心病 — 不稳定型心绞痛",
        "plan_name": "合并糖尿病 + 青霉素过敏个性化方案",
        "description": "在标准方案基础上：规避青霉素类抗生素，强化血糖监测，ACEI 替换 ARB",
        "medications": [
            {"name": "阿司匹林", "dose": "100mg qd", "route": "口服"},
            {"name": "氯吡格雷", "dose": "75mg qd", "route": "口服"},
            {"name": "硝酸异山梨酯", "dose": "10mg tid", "route": "口服"},
            {"name": "比索洛尔", "dose": "2.5mg qd", "route": "口服"},
            {"name": "培哚普利", "dose": "4mg qd", "route": "口服"},
            {"name": "阿托伐他汀", "dose": "20mg qn", "route": "口服"},
            {"name": "泮托拉唑", "dose": "40mg qd", "route": "口服（替代奥美拉唑）"},
        ],
        "non_drug_treatments": [
            "卧床休息", "持续心电监护", "血糖监测（三餐前 + 睡前）",
            "低盐低脂糖尿病饮食", "吸氧（2-4 L/min）",
        ],
        "contraindications": ["青霉素", "头孢", "奥美拉唑"],
        "adjustments": [
            "青霉素过敏：感染治疗选用大环内酯类或喹诺酮类",
            "CYP2C19 相互作用：奥美拉唑替换为泮托拉唑",
            "糖尿病：血糖目标住院期间 7.8–10 mmol/L",
            "ACEI（培哚普利）启动后 2 周复查血钾 + 肌酐",
        ],
    },
    {
        "plan_id": "P002",
        "plan_type": "personalized",
        "disease_name": "冠心病 — 不稳定型心绞痛",
        "plan_name": "PRECISE-DAPT 高危出血风险方案",
        "description": "PRECISE-DAPT ≥ 25 分，缩短 DAPT 疗程至 3-6 个月，加强胃黏膜保护",
        "medications": [
            {"name": "阿司匹林", "dose": "100mg qd", "route": "口服"},
            {"name": "氯吡格雷", "dose": "75mg qd（3-6 月后评估是否停用）", "route": "口服"},
            {"name": "泮托拉唑", "dose": "40mg qd", "route": "口服"},
        ],
        "non_drug_treatments": ["密切监测出血体征", "评估 Hb 变化趋势"],
        "contraindications": ["奥美拉唑"],
        "adjustments": ["DAPT 疗程缩短至 3-6 月", "定期评估出血风险"],
    },
]

# ══════════════════════════════════════════════════════
# 检查推荐库
# ══════════════════════════════════════════════════════
TESTS_KB = [
    {"test_id": "L001", "test_name": "高敏肌钙蛋白 I/T（hs-cTn）", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "UA 与 NSTEMI 的唯一决定性鉴别指标，需 0h/1h 连续检测", "sample_requirements": "静脉血 2ml，即刻送检", "category": "检验"},
    {"test_id": "L002", "test_name": "心肌酶谱（CK、CK-MB）", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "心肌损伤标志物，辅助评估心肌坏死程度", "sample_requirements": "静脉血 3ml", "category": "检验"},
    {"test_id": "L003", "test_name": "BNP / NT-proBNP", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "recommended", "reason": "排除心力衰竭合并缺血，评估左室功能状态", "sample_requirements": "静脉血 2ml", "category": "检验"},
    {"test_id": "L004", "test_name": "D-二聚体", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "recommended", "reason": "快速排除肺栓塞（患者有呼吸困难症状）", "sample_requirements": "静脉血 2ml", "category": "检验"},
    {"test_id": "L005", "test_name": "血常规 + 凝血功能", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "出血风险基线评估，双联抗血小板前必查", "sample_requirements": "静脉血 3ml（EDTA 抗凝）", "category": "检验"},
    {"test_id": "L006", "test_name": "肾功能 + 电解质（血钾）", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "GRACE 评分必要参数；ACEI 启用前安全评估", "sample_requirements": "静脉血 3ml", "category": "检验"},
    {"test_id": "L007", "test_name": "血糖 + HbA1c", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "患者合并糖尿病，住院期间血糖管理基线", "sample_requirements": "空腹静脉血 2ml", "category": "检验"},
    {"test_id": "L008", "test_name": "血脂全套（LDL-C、HDL-C、TG）", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "评估动脉粥样硬化程度，指导他汀治疗强度", "sample_requirements": "空腹静脉血 3ml", "category": "检验"},
    {"test_id": "I001", "test_name": "12 导联心电图（即刻 + 动态）", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "ST 段动态变化是 ACS 分型的核心依据", "sample_requirements": "床旁检查，即刻执行", "category": "检查"},
    {"test_id": "I002", "test_name": "床旁心脏超声（LVEF 评估）", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "required", "reason": "LVEF < 40% 影响治疗策略，排除瓣膜源性胸痛", "sample_requirements": "床旁超声，4 小时内完成", "category": "影像"},
    {"test_id": "I003", "test_name": "冠状动脉 CTA", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "recommended", "reason": "明确冠脉狭窄程度及斑块性质，为介入决策提供解剖依据", "sample_requirements": "预约检查，需肾功能正常", "category": "影像"},
    {"test_id": "I004", "test_name": "胸部 X 线", "disease_name": "冠心病 — 不稳定型心绞痛", "priority": "recommended", "reason": "排除肺部病变，评估心影大小", "sample_requirements": "床旁或放射科", "category": "影像"},
]

# ══════════════════════════════════════════════════════
# 循证医学知识条目
# ══════════════════════════════════════════════════════
KNOWLEDGE_ITEMS = [
    {"type": "指南", "title": "2023 ESC 急性冠脉综合征管理指南", "summary": "涵盖 UA/NSTEMI/STEMI 诊断、分层及治疗推荐，强调早期侵入性策略与双联抗血小板治疗规范。", "content": "GRACE 评分 > 140 分推荐 24h 内冠脉造影；0h/1h hs-cTn 快速诊断方案；DAPT 标准疗程 12 个月，出血高危缩短至 3-6 个月。", "tags": ["ACS", "心绞痛", "NSTEMI", "STEMI"], "source": "ESC 2023", "updated_at": "2023-08"},
    {"type": "指南", "title": "2024 ACC/AHA 心绞痛诊治指南", "summary": "更新冠心病稳定期和不稳定期的药物治疗策略，强调个体化风险评估。", "content": "推荐所有 ACS 患者启动高强度他汀；β阻滞剂为缺血治疗基石；ACEI/ARB 用于合并 EF 降低或糖尿病患者。", "tags": ["冠心病", "心绞痛", "降脂", "β阻滞剂"], "source": "ACC/AHA 2024", "updated_at": "2024-01"},
    {"type": "药物", "title": "氯吡格雷 + 奥美拉唑相互作用", "summary": "奥美拉唑抑制 CYP2C19，导致氯吡格雷活性代谢产物降低 40-50%，FDA 黑框警告。", "content": "推荐替换为泮托拉唑（CYP2C19 影响小）；合并 PPI 需求时选择兰索拉唑或雷贝拉唑。", "tags": ["氯吡格雷", "奥美拉唑", "CYP2C19", "药物相互作用"], "source": "FDA 警告 2010", "updated_at": "2023-06"},
    {"type": "药物", "title": "β阻滞剂在糖尿病患者中的使用", "summary": "β阻滞剂可掩盖低血糖症状（心悸、手抖），需加强血糖监测，心脏选择性 β1 阻滞剂（比索洛尔）相对安全。", "content": "使用期间建议血糖监测频率 ≥ 4 次/天；出汗异常仍可作为低血糖预警信号。", "tags": ["β阻滞剂", "糖尿病", "低血糖", "比索洛尔"], "source": "AHA 声明", "updated_at": "2022-11"},
    {"type": "疾病", "title": "不稳定型心绞痛与 NSTEMI 鉴别", "summary": "两者唯一区别在于高敏肌钙蛋白是否升高，临床表现高度相似。", "content": "UA：hs-cTn 阴性；NSTEMI：hs-cTn 升高。ESC 0h/1h 快速方案：若 0h 阴性且 1h 无显著变化（Δ < 6 ng/L），可排除 NSTEMI。", "tags": ["UA", "NSTEMI", "肌钙蛋白", "鉴别诊断"], "source": "ESC 指南", "updated_at": "2023-08"},
    {"type": "检验", "title": "GRACE 评分计算方法", "summary": "预测 ACS 患者院内及 6 个月死亡风险，8 个参数：年龄、心率、收缩压、肌酐、心脏骤停史、Killip 分级、ST 改变、心肌标志物。", "content": "评分 < 109 低危；109-140 中危；> 140 高危。高危推荐早期侵入性策略（24h 内冠脉造影）。", "tags": ["GRACE评分", "ACS", "风险分层"], "source": "GRACE 研究组", "updated_at": "2023-01"},
    {"type": "指南", "title": "2型糖尿病合并冠心病管理专家共识", "summary": "血糖控制目标与心血管风险管理并重，强调 GLP-1RA 和 SGLT-2i 的心血管保护效益。", "content": "住院期间血糖目标 7.8-10 mmol/L；HbA1c 目标 < 7%；冠心病合并糖尿病优先考虑 SGLT-2 抑制剂。", "tags": ["糖尿病", "冠心病", "血糖控制", "SGLT-2"], "source": "CDS/CSC 共识 2023", "updated_at": "2023-10"},
    {"type": "疾病", "title": "PRECISE-DAPT 评分与出血风险", "summary": "预测 DAPT 期间出血事件，≥ 25 分为出血高危，建议缩短 DAPT 至 3-6 个月。", "content": "5 个参数：年龄、肌酐清除率、血红蛋白、白细胞、既往出血史。高危时权衡缺血 vs 出血，个体化决策。", "tags": ["PRECISE-DAPT", "出血风险", "抗血小板", "DAPT"], "source": "PRECISE-DAPT 研究", "updated_at": "2022-05"},
]


# ══════════════════════════════════════════════════════
# 导入执行
# ══════════════════════════════════════════════════════

def seed_all():
    init_db()
    with get_conn() as conn:
        # 患者
        for p in PATIENTS:
            conn.execute("""
                INSERT OR REPLACE INTO patients
                (patient_id, name, gender, age, department, visit_id,
                 chief_complaint, present_illness, past_history,
                 chronic_diseases, allergies, risk_tags)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                p["patient_id"], p["name"], p["gender"], p["age"],
                p["department"], p["visit_id"],
                p["chief_complaint"], p["present_illness"], p["past_history"],
                json.dumps(p["chronic_diseases"], ensure_ascii=False),
                json.dumps(p["allergies"], ensure_ascii=False),
                json.dumps(p["risk_tags"], ensure_ascii=False),
            ))

        # 诊断知识库
        conn.execute("DELETE FROM diagnoses_kb")
        for d in DIAGNOSES_KB:
            conn.execute("""
                INSERT INTO diagnoses_kb
                (disease_name, icd_code, match_symptoms, match_signs,
                 match_history, base_confidence, reasoning_template, tags)
                VALUES (?,?,?,?,?,?,?,?)
            """, (
                d["disease_name"], d["icd_code"],
                json.dumps(d["match_symptoms"], ensure_ascii=False),
                json.dumps(d["match_signs"], ensure_ascii=False),
                json.dumps(d["match_history"], ensure_ascii=False),
                d["base_confidence"],
                d["reasoning_template"],
                json.dumps(d["tags"], ensure_ascii=False),
            ))

        # 治疗方案库
        conn.execute("DELETE FROM treatments_kb")
        for t in TREATMENTS_KB:
            conn.execute("""
                INSERT INTO treatments_kb
                (plan_id, plan_type, disease_name, plan_name, description,
                 medications, non_drug_treatments, contraindications, adjustments)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (
                t["plan_id"], t["plan_type"], t["disease_name"],
                t["plan_name"], t["description"],
                json.dumps(t["medications"], ensure_ascii=False),
                json.dumps(t["non_drug_treatments"], ensure_ascii=False),
                json.dumps(t["contraindications"], ensure_ascii=False),
                json.dumps(t["adjustments"], ensure_ascii=False),
            ))

        # 检查库
        conn.execute("DELETE FROM tests_kb")
        for t in TESTS_KB:
            conn.execute("""
                INSERT INTO tests_kb
                (test_id, test_name, disease_name, priority,
                 reason, sample_requirements, category)
                VALUES (?,?,?,?,?,?,?)
            """, (
                t["test_id"], t["test_name"], t["disease_name"],
                t["priority"], t["reason"], t["sample_requirements"],
                t["category"],
            ))

        # 知识条目
        conn.execute("DELETE FROM knowledge_items")
        for k in KNOWLEDGE_ITEMS:
            conn.execute("""
                INSERT INTO knowledge_items
                (type, title, summary, content, tags, source, updated_at)
                VALUES (?,?,?,?,?,?,?)
            """, (
                k["type"], k["title"], k["summary"], k["content"],
                json.dumps(k["tags"], ensure_ascii=False),
                k["source"], k["updated_at"],
            ))

    print(f"[Seed] 导入完成："
          f"{len(PATIENTS)} 患者, {len(DIAGNOSES_KB)} 诊断, "
          f"{len(TREATMENTS_KB)} 治疗方案, {len(TESTS_KB)} 检查项, "
          f"{len(KNOWLEDGE_ITEMS)} 知识条目")


if __name__ == "__main__":
    seed_all()
