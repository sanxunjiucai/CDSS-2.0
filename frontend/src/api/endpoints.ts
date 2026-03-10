/** 所有后端接口的类型化调用函数 */
import { apiGet, apiPost } from './client'
import type { PatientContext, ParsedEntity, SearchResult } from '../types'

// ── 患者 ──────────────────────────────────────────────
export const fetchPatient = (patientId: string) =>
  apiGet<PatientContext>(`/api/patient/${patientId}`)

// ── 辅助输入 ──────────────────────────────────────────
export const parseInput = (payload: {
  chief_complaint: string
  present_illness: string
  past_history: string
}) => apiPost<{ entities: ParsedEntity[] }>('/api/input/parse', payload)

export const fetchSymptomTags = () =>
  apiGet<string[]>('/api/input/symptom-tags')

export const fetchSignTags = () =>
  apiGet<string[]>('/api/input/sign-tags')

// ── 辅助诊断 ──────────────────────────────────────────
export const fetchDiagnoses = (entities: ParsedEntity[]) =>
  apiPost<DiagnosisResult[]>('/api/diagnosis/recommend', { entities })

export interface DiagnosisResult {
  disease_name: string
  icd_code: string
  confidence: number
  priority: number
  reasoning: string
  tags: string[]
}

// ── 治疗方案 ──────────────────────────────────────────
export const fetchCommonTreatments = (diagnosis: string) =>
  apiPost<TreatmentPlan[]>('/api/treatment/common', { diagnosis })

export const fetchPersonalizedTreatments = (diagnosis: string, patient_context: PatientContext) =>
  apiPost<TreatmentPlan[]>('/api/treatment/personalized', { diagnosis, patient_context })

export interface TreatmentPlan {
  plan_id: string
  plan_name: string
  plan_type: string
  description: string
  medications: { name: string; dose: string; route: string }[]
  non_drug_treatments: string[]
  contraindications: string[]
  adjustments: string[]
  has_contraindication?: boolean
}

// ── 检验检查 ──────────────────────────────────────────
export const fetchRecommendedTests = (diagnosis: string) =>
  apiPost<TestItem[]>('/api/tests/recommend', { diagnosis })

export interface TestItem {
  test_id: string
  test_name: string
  disease_name: string
  priority: 'required' | 'recommended' | 'optional'
  reason: string
  sample_requirements: string
  category: string
}

// ── 结果解读 ──────────────────────────────────────────
export const interpretLabResults = (results: LabResult[]) =>
  apiPost<{ results: InterpretedResult[]; alerts: LabAlert[] }>(
    '/api/lab-results/interpret', { results }
  )

export interface LabResult {
  test_id: string
  test_name: string
  value: string | number | null
  unit: string
  reference_range: string
  status: 'normal' | 'high' | 'low' | 'critical' | 'pending'
}

export interface InterpretedResult extends LabResult {
  comment: string
}

export interface LabAlert {
  test_name: string
  status: string
  message: string
}

// ── 风险审核 ──────────────────────────────────────────
export const fetchRiskAssessment = (
  patient_context: PatientContext,
  diagnosis: string,
  lab_values?: Record<string, unknown>
) => apiPost<RiskAssessmentResult>('/api/risk/assess', { patient_context, diagnosis, lab_values })

export const fetchAuditAlerts = (
  diagnosis: string,
  treatment: unknown,
  patient_context: PatientContext
) => apiPost<AuditAlert[]>('/api/risk/audit', { diagnosis, treatment, patient_context })

export interface RiskAssessmentResult {
  diagnosis: string
  risk_scores: RiskScore[]
  overall_level: string
}

export interface RiskScore {
  name: string
  score: number | string
  max: number
  level: string
  description: string
  factors: { name: string; value: string; contribution: string; pts: number }[]
}

export interface AuditAlert {
  id: string
  category: string
  level: string
  title: string
  detail: string
  related: string[]
  action: string
}

// ── 评估与转诊 ────────────────────────────────────────
export const fetchAssessmentScales = (
  patient_context: PatientContext,
  entities: ParsedEntity[],
  diagnosis: string
) => apiPost<{ scales: ScaleResult[]; risk_scores: RiskScore[] }>(
  '/api/assessment/scales', { patient_context, entities, diagnosis }
)

export const generateAssessmentSummary = (payload: Record<string, unknown>) =>
  apiPost<{ summary: string }>('/api/assessment/summary', payload)

export interface ScaleResult {
  id: string
  name: string
  score: number | string
  max?: number
  level: string
  levelLabel: string
  description: string
  basis: string[]
}

// ── 循证搜索 ──────────────────────────────────────────
export const fetchSearchCategories = () =>
  apiGet<string[]>('/api/search/categories')

export const searchKnowledge = (keyword: string, category: string) =>
  apiGet<SearchResult[]>(
    `/api/search?keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}`
  )

// ── 会话状态 ──────────────────────────────────────────
export const saveSessionState = (sessionId: string, patientId: string, state: Record<string, unknown>) =>
  apiPost<{ session_id: string; state: Record<string, unknown> }>(
    `/api/session/${sessionId}`, { patient_id: patientId, state }
  )

export const fetchSessionState = (sessionId: string) =>
  apiGet<{ session_id: string; state: Record<string, unknown> }>(`/api/session/${sessionId}`)
