import { create } from 'zustand'
import { PatientContext, DiagnosisRecommendation, TreatmentPlan, TestRecommendation, RiskAssessment, StepId, ParsedEntity, EntityCategory, SearchCategory, SearchResult, SearchStatus, WritebackStatus, ToastMessage } from './types'

interface AppState {
  currentStep: StepId
  patientContext: PatientContext | null

  // 辅助输入 — HIS上下文解析
  parsedEntities: ParsedEntity[]

  // 辅助诊断
  diagnoses: DiagnosisRecommendation[]
  selectedDiagnosis: string

  // 通用治疗
  commonPlans: TreatmentPlan[]
  selectedCommonPlan: string

  // 个性化治疗
  personalizedPlans: TreatmentPlan[]
  selectedPersonalizedPlan: string

  // 检验检查
  recommendedTests: TestRecommendation[]
  selectedTests: string[]
  testResultStatuses: Record<string, string>   // test_id → ResultStatus

  // 风险审核
  riskAssessment: RiskAssessment | null
  auditAlerts: any[]

  // 搜索
  searchCategory: SearchCategory
  searchKeyword: string
  searchHistory: string[]
  searchResults: SearchResult[]
  searchStatus: SearchStatus
  selectedResult: SearchResult | null

  // 回写 HIS
  writebackModalOpen: boolean
  writebackStatus: WritebackStatus

  // Toast 通知
  toasts: ToastMessage[]

  // Actions
  setCurrentStep: (step: StepId) => void
  setPatientContext: (context: PatientContext) => void
  setParsedEntities: (entities: ParsedEntity[]) => void
  toggleEntityConfirm: (id: string) => void
  removeEntity: (id: string) => void
  addEntity: (entity: ParsedEntity) => void
  updateEntityCategory: (id: string, category: EntityCategory) => void
  setDiagnoses: (diagnoses: DiagnosisRecommendation[]) => void
  setSelectedDiagnosis: (diagnosis: string) => void
  setCommonPlans: (plans: TreatmentPlan[]) => void
  setSelectedCommonPlan: (planId: string) => void
  setPersonalizedPlans: (plans: TreatmentPlan[]) => void
  setSelectedPersonalizedPlan: (planId: string) => void
  setRecommendedTests: (tests: TestRecommendation[]) => void
  toggleTest: (testId: string) => void
  setTestResultStatus: (testId: string, status: string) => void
  selectAllRequired: (requiredIds: string[]) => void
  clearAllTests: () => void
  setRiskAssessment: (assessment: RiskAssessment) => void
  setAuditAlerts: (alerts: any[]) => void

  // 搜索 actions
  setSearchCategory: (cat: SearchCategory) => void
  setSearchKeyword: (kw: string) => void
  pushSearchHistory: (kw: string) => void
  clearSearchHistory: () => void
  setSearchResults: (results: SearchResult[]) => void
  setSearchStatus: (status: SearchStatus) => void
  setSelectedResult: (result: SearchResult | null) => void
  resetSearch: () => void

  // 回写 HIS actions
  openWritebackModal: () => void
  closeWritebackModal: () => void
  setWritebackStatus: (status: WritebackStatus) => void

  // Toast actions
  showToast: (message: string, type: ToastMessage['type']) => void
  dismissToast: (id: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentStep: 'input',
  patientContext: null,
  parsedEntities: [],
  diagnoses: [],
  selectedDiagnosis: '',
  commonPlans: [],
  selectedCommonPlan: '',
  personalizedPlans: [],
  selectedPersonalizedPlan: '',
  recommendedTests: [],
  selectedTests: [],
  testResultStatuses: {},
  riskAssessment: null,
  auditAlerts: [],

  // 搜索初始值
  searchCategory: '全部',
  searchKeyword: '',
  searchHistory: [],
  searchResults: [],
  searchStatus: 'idle',
  selectedResult: null,

  // 回写 HIS 初始值
  writebackModalOpen: false,
  writebackStatus: 'idle',

  // Toast 初始值
  toasts: [],

  setCurrentStep: (step) => set({ currentStep: step }),
  setPatientContext: (context) => set({ patientContext: context }),
  setParsedEntities: (entities) => set({ parsedEntities: entities }),
  toggleEntityConfirm: (id) => set((state) => ({
    parsedEntities: state.parsedEntities.map(e => e.id === id ? { ...e, confirmed: !e.confirmed } : e)
  })),
  removeEntity: (id) => set((state) => ({
    parsedEntities: state.parsedEntities.filter(e => e.id !== id)
  })),
  addEntity: (entity) => set((state) => ({
    parsedEntities: [...state.parsedEntities, entity]
  })),
  updateEntityCategory: (id, category) => set((state) => ({
    parsedEntities: state.parsedEntities.map(e => e.id === id ? { ...e, category } : e)
  })),
  setDiagnoses: (diagnoses) => set({ diagnoses }),
  setSelectedDiagnosis: (diagnosis) => set({ selectedDiagnosis: diagnosis }),
  setCommonPlans: (plans) => set({ commonPlans: plans }),
  setSelectedCommonPlan: (planId) => set({ selectedCommonPlan: planId }),
  setPersonalizedPlans: (plans) => set({ personalizedPlans: plans }),
  setSelectedPersonalizedPlan: (planId) => set({ selectedPersonalizedPlan: planId }),
  setRecommendedTests: (tests) => set({ recommendedTests: tests }),
  toggleTest: (testId) => set((state) => ({
    selectedTests: state.selectedTests.includes(testId)
      ? state.selectedTests.filter(id => id !== testId)
      : [...state.selectedTests, testId]
  })),
  setTestResultStatus: (testId, status) => set((state) => ({
    testResultStatuses: { ...state.testResultStatuses, [testId]: status }
  })),
  selectAllRequired: (requiredIds) => set((state) => ({
    selectedTests: [...new Set([...state.selectedTests, ...requiredIds])]
  })),
  clearAllTests: () => set({ selectedTests: [], testResultStatuses: {} }),
  setRiskAssessment: (assessment) => set({ riskAssessment: assessment }),
  setAuditAlerts: (alerts) => set({ auditAlerts: alerts }),

  setSearchCategory: (cat) => set({ searchCategory: cat }),
  setSearchKeyword: (kw) => set({ searchKeyword: kw }),
  pushSearchHistory: (kw) => set((state) => ({
    searchHistory: [kw, ...state.searchHistory.filter(h => h !== kw)].slice(0, 8)
  })),
  clearSearchHistory: () => set({ searchHistory: [] }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchStatus: (status) => set({ searchStatus: status }),
  setSelectedResult: (result) => set({ selectedResult: result }),
  resetSearch: () => set({ searchKeyword: '', searchResults: [], searchStatus: 'idle', selectedResult: null }),

  openWritebackModal: () => set({ writebackModalOpen: true, writebackStatus: 'previewing' }),
  closeWritebackModal: () => set({ writebackModalOpen: false, writebackStatus: 'idle' }),
  setWritebackStatus: (status) => set({ writebackStatus: status }),

  showToast: (message, type) => set((state) => ({
    toasts: [...state.toasts, { id: Date.now(), message, type }]
  })),
  dismissToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
}))
