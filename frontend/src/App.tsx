import { useEffect, useRef } from 'react'
import { useAppStore } from './store'
import { fetchPatient, saveSessionState, fetchSessionState } from './api/endpoints'
import TopBar from './components/TopBar'
import StepNav from './components/StepNav'
import BottomBar from './components/BottomBar'
import WritebackModal from './components/WritebackModal'
import ToastContainer from './components/Toast'
import InputPage from './pages/InputPage'
import DiagnosisPage from './pages/DiagnosisPage'
import CommonTreatmentPage from './pages/CommonTreatmentPage'
import PersonalizedTreatmentPage from './pages/PersonalizedTreatmentPage'
import TestsPage from './pages/TestsPage'
import LabResultsPage from './pages/LabResultsPage'
import EvidencePage from './pages/EvidencePage'
import AssessmentPage from './pages/AssessmentPage'
import RiskPage from './pages/RiskPage'
import './App.css'

// ── 会话 ID 管理（localStorage 持久化）──────────────────
function getOrCreateSessionId(patientId: string): string {
  const key = `cdss_session_${patientId}`
  let id = localStorage.getItem(key)
  if (!id) {
    id = `${patientId}_${Date.now()}`
    localStorage.setItem(key, id)
  }
  return id
}

const MOCK_PATIENT = {
  patient_id: 'P20260309001',
  name: '张三',
  gender: '男',
  age: 58,
  department: '心内科',
  visit_id: 'MZ20260309001',
  chief_complaint: '胸闷气短 3 天，伴心悸',
  present_illness: '活动后胸闷气短加重，休息后可缓解，伴乏力。',
  past_history: '高血压 10 年，糖尿病 5 年，青霉素过敏。',
  chronic_diseases: ['高血压', '糖尿病'],
  allergies: ['青霉素'],
  risk_tags: ['心血管高危', '血糖控制不佳']
}

export default function App() {
  const {
    currentStep, setCurrentStep,
    patientContext, setPatientContext,
    parsedEntities,
    selectedDiagnosis,
    selectedCommonPlan,
    selectedPersonalizedPlan,
    selectedTests,
    openWritebackModal,
    showToast,
    restoreSession,
  } = useAppStore()

  const sessionIdRef = useRef<string>('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 启动：加载患者 + 恢复会话 ────────────────────────
  useEffect(() => {
    const patientId = MOCK_PATIENT.patient_id
    sessionIdRef.current = getOrCreateSessionId(patientId)

    fetchPatient(patientId)
      .then(ctx => setPatientContext(ctx))
      .catch(() => setPatientContext(MOCK_PATIENT))

    fetchSessionState(sessionIdRef.current)
      .then(res => { if (res.state) restoreSession(res.state) })
      .catch(() => {/* 无历史会话，静默处理 */})
  }, [setPatientContext, restoreSession])

  // ── 状态变化时防抖保存会话（500ms）───────────────────
  useEffect(() => {
    if (!sessionIdRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveSessionState(sessionIdRef.current, MOCK_PATIENT.patient_id, {
        selectedDiagnosis,
        selectedCommonPlan,
        selectedPersonalizedPlan,
        selectedTests,
        parsedEntities,
      }).catch(() => {/* 保存失败静默处理 */})
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [selectedDiagnosis, selectedCommonPlan, selectedPersonalizedPlan, selectedTests, parsedEntities])

  // 各页签主操作 ——————————————————————————

  const handleConfirmInput = () => {
    const accepted = parsedEntities.filter((e: { status: string }) => e.status === 'accepted')
    if (accepted.length === 0) { showToast('请先接受至少一条临床信息', 'error'); return }
    setCurrentStep('diagnosis')
  }

  const handleConfirmDiagnosis = () => {
    if (!selectedDiagnosis) { showToast('请先选择一个诊断方案', 'error'); return }
    showToast(`诊断方案已确认：${selectedDiagnosis}`, 'success')
  }

  const handleConfirmCommonTreatment = () => {
    if (!selectedCommonPlan) { showToast('请先选择通用治疗方案', 'error'); return }
    showToast('通用治疗方案已确认', 'success')
  }

  const handleConfirmPersonalizedTreatment = () => {
    if (!selectedPersonalizedPlan) { showToast('请先选择个性化治疗方案', 'error'); return }
    showToast('个性化治疗方案已确认', 'success')
  }

  const handleConfirmTests = () => {
    if (selectedTests.length === 0) { showToast('请先勾选检查项目', 'error'); return }
    showToast(`已确认 ${selectedTests.length} 项检查`, 'success')
  }

  const handleExportReport = () => {
    showToast('综合报告已生成并输出', 'success')
  }

  const handleCopyToRecord = () => {
    showToast('当前内容已复制到剪贴板，可粘贴至病历', 'info')
  }

  const renderPage = () => {
    switch (currentStep) {
      case 'input':                  return <InputPage />
      case 'diagnosis':              return <DiagnosisPage />
      case 'common-treatment':       return <CommonTreatmentPage />
      case 'personalized-treatment': return <PersonalizedTreatmentPage />
      case 'tests':                  return <TestsPage />
      case 'lab-results':            return <LabResultsPage />
      case 'evidence':               return <EvidencePage />
      case 'assessment':             return <AssessmentPage />
      case 'risk':                   return <RiskPage />
      default:                       return null
    }
  }

  return (
    <div className="app">
      <TopBar patient={patientContext} />
      <div className="app-body">
        <StepNav currentStep={currentStep} onStepChange={setCurrentStep} />
        <div className="app-content">{renderPage()}</div>
      </div>
      <BottomBar
        currentStep={currentStep}
        onSave={() => {
          saveSessionState(sessionIdRef.current, MOCK_PATIENT.patient_id, {
            selectedDiagnosis, selectedCommonPlan, selectedPersonalizedPlan,
            selectedTests, parsedEntities,
          }).then(() => showToast('草稿已保存', 'info'))
            .catch(() => showToast('保存失败', 'error'))
        }}
        onConfirmInput={handleConfirmInput}
        onConfirmDiagnosis={handleConfirmDiagnosis}
        onConfirmCommonTreatment={handleConfirmCommonTreatment}
        onConfirmPersonalizedTreatment={handleConfirmPersonalizedTreatment}
        onConfirmTests={handleConfirmTests}
        onExportReport={handleExportReport}
        onCopyToRecord={handleCopyToRecord}
      />

      {/* 全局浮层组件 */}
      <WritebackModal />
      <ToastContainer />
    </div>
  )
}
