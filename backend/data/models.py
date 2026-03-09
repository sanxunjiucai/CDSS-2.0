"""数据模型定义"""
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class PatientContext:
    patient_id: str
    name: str
    gender: str
    age: int
    department: str
    visit_id: str
    chief_complaint: str
    chronic_diseases: List[str]
    allergies: List[str]
    risk_tags: List[str]

@dataclass
class DiagnosisRecommendation:
    disease_name: str
    confidence: float
    priority: int
    reasoning: str

@dataclass
class TreatmentPlan:
    plan_id: str
    plan_name: str
    description: str
    medications: List[dict]
    non_drug_treatments: List[str]

@dataclass
class TestRecommendation:
    test_id: str
    test_name: str
    priority: str  # required/recommended/optional
    reason: str
    sample_requirements: str

@dataclass
class RiskAssessment:
    model_name: str
    risk_score: float
    risk_level: str
    future_risks: List[dict]
    interventions: List[str]
