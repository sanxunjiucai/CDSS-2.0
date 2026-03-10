"""API 层 — Flask 路由，调用服务层能力"""
import sys
import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from flask import Flask, jsonify, request
from flask_cors import CORS

from backend.services.patient_service import PatientService
from backend.services.input_service import InputService
from backend.services.diagnosis_service import DiagnosisService
from backend.services.treatment_service import TreatmentService
from backend.services.test_service import TestService
from backend.services.risk_service import RiskService
from backend.services.search_service import SearchService
from backend.data.repositories.session_repo import (
    get_or_create_session, update_session_state, get_session_state
)
from backend.tools.scale_engine import calc_all_scales

app = Flask(__name__)
CORS(app)


# ══════════════════════════════════════════════════════
# 患者
# ══════════════════════════════════════════════════════

@app.route('/api/patient/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    return jsonify(PatientService.get_patient_context(patient_id))


# ══════════════════════════════════════════════════════
# 辅助输入
# ══════════════════════════════════════════════════════

@app.route('/api/input/parse', methods=['POST'])
def parse_input():
    data = request.json or {}
    result = InputService.parse_chief_complaint(
        chief_complaint=data.get('chief_complaint', data.get('text', '')),
        present_illness=data.get('present_illness', ''),
        past_history=data.get('past_history', ''),
    )
    return jsonify(result)


@app.route('/api/input/symptom-tags', methods=['GET'])
def get_symptom_tags():
    return jsonify(InputService.get_common_symptom_tags())


@app.route('/api/input/sign-tags', methods=['GET'])
def get_sign_tags():
    return jsonify(InputService.get_common_sign_tags())


# ══════════════════════════════════════════════════════
# 辅助诊断
# ══════════════════════════════════════════════════════

@app.route('/api/diagnosis/recommend', methods=['POST'])
def recommend_diagnosis():
    data = request.json or {}
    entities = data.get('entities', [])
    if not entities and (data.get('symptoms') or data.get('signs')):
        return jsonify(DiagnosisService.get_recommended_diagnoses_from_text(
            data.get('symptoms', []), data.get('signs', [])
        ))
    return jsonify(DiagnosisService.get_recommended_diagnoses(entities))


# ══════════════════════════════════════════════════════
# 治疗方案
# ══════════════════════════════════════════════════════

@app.route('/api/treatment/common', methods=['POST'])
def get_common_treatment():
    data = request.json or {}
    return jsonify(TreatmentService.get_common_treatment_plans(data.get('diagnosis', '')))


@app.route('/api/treatment/personalized', methods=['POST'])
def get_personalized_treatment():
    data = request.json or {}
    return jsonify(TreatmentService.get_personalized_treatment_plans(
        data.get('diagnosis', ''), data.get('patient_context', {})
    ))


# ══════════════════════════════════════════════════════
# 检验检查
# ══════════════════════════════════════════════════════

@app.route('/api/tests/recommend', methods=['POST'])
def recommend_tests():
    data = request.json or {}
    return jsonify(TestService.get_recommended_tests(data.get('diagnosis', '')))


# ══════════════════════════════════════════════════════
# 结果解读（新增）
# ══════════════════════════════════════════════════════

_INTERPRET_TEMPLATES = {
    "高敏肌钙蛋白": {
        "high":     "hs-cTn 升高，提示心肌损伤，需排除 NSTEMI，建议 1h 后复查。",
        "critical": "hs-cTn 危急值，高度提示 NSTEMI，建议立即启动 ACS 处置流程。",
        "normal":   "hs-cTn 正常，当前时间点心肌损伤证据不足，需结合 1h 复查结果。",
    },
    "血钾": {
        "high":   "血钾偏高，ACEI 启用需谨慎，>5.5 mmol/L 建议暂缓。",
        "low":    "血钾偏低，存在心律失常风险，需及时补钾。",
        "normal": "血钾正常，ACEI 用药安全。",
    },
    "肌酐": {
        "high":   "肌酐升高，肾功能受损，ACEI 剂量需调整，GRACE 评分精度受影响。",
        "normal": "肾功能正常，当前用药方案肾脏安全性良好。",
    },
    "血糖": {
        "high":     "血糖偏高，住院期间目标控制在 7.8–10 mmol/L，需调整降糖方案。",
        "critical": "血糖危急值，立即处理，必要时胰岛素干预。",
        "low":      "血糖偏低，β阻滞剂可掩盖低血糖症状，需及时处理并加强监测。",
        "normal":   "血糖在目标范围内。",
    },
    "BNP": {
        "high":   "BNP 升高，提示心脏负荷增加，需评估心功能，考虑加用利尿剂。",
        "normal": "BNP 正常，当前心衰证据不足。",
    },
    "D-二聚体": {
        "high":   "D-二聚体升高，不能排除肺栓塞，建议进一步行 CTPA 检查。",
        "normal": "D-二聚体正常，肺栓塞低可能性。",
    },
}


def _interpret_single(name: str, status: str) -> str:
    for key, status_map in _INTERPRET_TEMPLATES.items():
        if key in name:
            return status_map.get(status, f"{name} 结果已接收，请结合临床综合判断。")
    return f"{name} 结果已接收，请结合临床综合判断。"


@app.route('/api/lab-results/interpret', methods=['POST'])
def interpret_lab_results():
    data = request.json or {}
    results = data.get('results', [])
    interpreted = []
    alerts = []

    for r in results:
        name   = r.get('test_name', '')
        status = r.get('status', 'normal')
        comment = _interpret_single(name, status)
        interpreted.append({**r, "comment": comment})
        if status in ('critical', 'high'):
            alerts.append({
                "test_name": name,
                "status": status,
                "message": f"{name} {'危急值' if status == 'critical' else '偏高'}，需关注",
            })

    return jsonify({"results": interpreted, "alerts": alerts})


# ══════════════════════════════════════════════════════
# 风险审核
# ══════════════════════════════════════════════════════

@app.route('/api/risk/assess', methods=['POST'])
def assess_risk():
    data = request.json or {}
    return jsonify(RiskService.assess_risk(
        data.get('patient_context', {}),
        data.get('diagnosis', ''),
        data.get('lab_values'),
    ))


@app.route('/api/risk/audit', methods=['POST'])
def audit_treatment():
    data = request.json or {}
    return jsonify(RiskService.get_audit_alerts(
        data.get('diagnosis', ''),
        data.get('treatment', {}),
        data.get('patient_context', {}),
    ))


@app.route('/api/risk/scales', methods=['POST'])
def get_scale_results():
    data = request.json or {}
    return jsonify(RiskService.get_scale_results(
        data.get('patient_context', {}),
        data.get('entities', []),
    ))


# ══════════════════════════════════════════════════════
# 评估与转诊（新增）
# ══════════════════════════════════════════════════════

@app.route('/api/assessment/scales', methods=['POST'])
def get_assessment_scales():
    data     = request.json or {}
    patient  = data.get('patient_context', {})
    entities = data.get('entities', [])
    lab_vals = data.get('lab_values', {})

    scales      = calc_all_scales(patient, entities)
    risk_result = RiskService.assess_risk(patient, data.get('diagnosis', ''), lab_vals)

    return jsonify({
        "scales":      scales,
        "risk_scores": risk_result.get("risk_scores", []),
    })


@app.route('/api/assessment/summary', methods=['POST'])
def generate_assessment_summary():
    data    = request.json or {}
    patient = data.get('patient_context', {})
    name    = patient.get('name', '—')
    visit   = patient.get('visit_id', '—')
    dx      = data.get('diagnosis', '—')

    lines = [
        "【评估与转诊摘要（系统生成）】",
        f"患者：{name}   就诊号：{visit}",
        f"当前诊断：{dx}",
        f"转诊处置：{data.get('referral_decision', '待选择')}  "
        f"紧急程度：{data.get('referral_urgency', '—')}",
        "",
        "【量表汇总】",
    ]
    for s in data.get('scales', []):
        lines.append(f"· {s['name']}：{s['score']} {s.get('levelLabel', '')}")

    lines += ["", "【风险评分】"]
    for r in data.get('risk_scores', []):
        lines.append(f"· {r['name']}：{r['score']}/{r.get('max', '—')} ({r['level']})")

    lines += [
        "",
        f"生成时间：{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    ]
    return jsonify({"summary": "\n".join(lines)})


# ══════════════════════════════════════════════════════
# 循证搜索
# ══════════════════════════════════════════════════════

@app.route('/api/search/categories', methods=['GET'])
def get_search_categories():
    return jsonify(SearchService.get_categories())


@app.route('/api/search', methods=['GET'])
def search():
    keyword  = request.args.get('keyword', '')
    category = request.args.get('category', '全部')
    return jsonify(SearchService.search(keyword, category))


# ══════════════════════════════════════════════════════
# 会话状态（新增）
# ══════════════════════════════════════════════════════

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    return jsonify({"session_id": session_id, "state": get_session_state(session_id)})


@app.route('/api/session/<session_id>', methods=['POST'])
def save_session(session_id):
    data = request.json or {}
    get_or_create_session(session_id, data.get('patient_id', ''))
    state = update_session_state(session_id, data.get('state', {}))
    return jsonify({"session_id": session_id, "state": state})


# ══════════════════════════════════════════════════════
# 启动
# ══════════════════════════════════════════════════════

if __name__ == '__main__':
    from backend.data.seed import seed_all
    seed_all()
    app.run(debug=True, port=5000)
