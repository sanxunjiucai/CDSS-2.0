export interface PatientContext {
  patient_id: string
  name: string
  gender: string
  age: number
  department: string
  visit_id: string
  chief_complaint: string
  present_illness: string
  past_history: string
  chronic_diseases: string[]
  allergies: string[]
  risk_tags: string[]
}

export type EntityCategory = '症状' | '体征' | '疾病' | '检查' | '风险'

export interface ParsedEntity {
  id: string
  text: string
  category: EntityCategory
  source: '主诉' | '现病史' | '既往史' | '补充'
  confirmed: boolean
}

export interface DiagnosisRecommendation {
  disease_name: string
  confidence: number
  priority: number
  reasoning: string
}

export interface TreatmentPlan {
  plan_id: string
  plan_name: string
  description: string
  medications: Array<{name: string; dose: string; route: string}>
  non_drug_treatments?: string[]
  adjustments?: string[]
}

export interface TestRecommendation {
  test_id: string
  test_name: string
  priority: 'required' | 'recommended' | 'optional'
  reason: string
  sample_requirements: string
}

export interface RiskAssessment {
  model_name: string
  risk_score: number
  risk_level: string
  future_risks: Array<{disease: string; probability: string; timeframe: string}>
  interventions: string[]
}

export type StepId = 'input' | 'diagnosis' | 'common-treatment' | 'personalized-treatment' | 'tests' | 'lab-results' | 'evidence' | 'assessment' | 'risk'

// ── 回写 HIS ──
export interface WritebackSection {
  field: string       // HIS 字段名
  original: string    // 当前值（来自 HIS）
  newValue: string    // 将回写的值
  changed: boolean    // 是否有变化
}

export interface WritebackPreview {
  patientId: string
  visitId: string
  sections: WritebackSection[]
  generatedAt: string
}

export type WritebackStatus = 'idle' | 'previewing' | 'submitting' | 'success' | 'error'

// ── Toast 通知 ──
export interface ToastMessage {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}
export type SearchCategory = '全部' | '指南' | '药物' | '疾病' | '检验'
export type SearchStatus = 'idle' | 'loading' | 'done'

export interface SearchResult {
  id: string
  type: string        // 展示用分类标签（指南 / 药物 / 疾病 / 检验）
  title: string
  summary: string
  content: string
  tags: string[]
  source: string
  updatedAt: string
}
