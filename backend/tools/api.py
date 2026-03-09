"""API工具层 - 封装服务层能力"""
import sys
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

app = Flask(__name__)
CORS(app)

@app.route('/api/patient/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    return jsonify(PatientService.get_patient_context(patient_id))

@app.route('/api/input/parse', methods=['POST'])
def parse_input():
    data = request.json
    return jsonify(InputService.parse_chief_complaint(data.get('text', '')))

@app.route('/api/input/symptom-tags', methods=['GET'])
def get_symptom_tags():
    return jsonify(InputService.get_common_symptom_tags())

@app.route('/api/input/sign-tags', methods=['GET'])
def get_sign_tags():
    return jsonify(InputService.get_common_sign_tags())

@app.route('/api/diagnosis/recommend', methods=['POST'])
def recommend_diagnosis():
    data = request.json
    return jsonify(DiagnosisService.get_recommended_diagnoses(
        data.get('symptoms', []), data.get('signs', [])
    ))

@app.route('/api/treatment/common', methods=['POST'])
def get_common_treatment():
    data = request.json
    return jsonify(TreatmentService.get_common_treatment_plans(data.get('diagnosis', '')))

@app.route('/api/treatment/personalized', methods=['POST'])
def get_personalized_treatment():
    data = request.json
    return jsonify(TreatmentService.get_personalized_treatment_plans(
        data.get('diagnosis', ''), data.get('patient_context', {})
    ))

@app.route('/api/tests/recommend', methods=['POST'])
def recommend_tests():
    data = request.json
    return jsonify(TestService.get_recommended_tests(data.get('diagnosis', '')))

@app.route('/api/risk/assess', methods=['POST'])
def assess_risk():
    data = request.json
    return jsonify(RiskService.assess_risk(
        data.get('patient_context', {}), data.get('diagnosis', '')
    ))

@app.route('/api/risk/audit', methods=['POST'])
def audit_treatment():
    data = request.json
    return jsonify(RiskService.get_audit_alerts(
        data.get('diagnosis', ''), data.get('treatment', {})
    ))

@app.route('/api/search/categories', methods=['GET'])
def get_search_categories():
    return jsonify(SearchService.get_categories())

@app.route('/api/search', methods=['GET'])
def search():
    keyword = request.args.get('keyword', '')
    category = request.args.get('category', '综合')
    return jsonify(SearchService.search(keyword, category))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
