// AssessmentPage — 评估与转诊
import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store'
import { fetchAssessmentScales, generateAssessmentSummary } from '../api/endpoints'
import type { ScaleResult as ApiScaleResult } from '../api/endpoints'
import './common.css'
import './AssessmentPage.css'

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

type ComplexityLevel = 'high' | 'moderate' | 'low'
type ReferralUrgency = 'emergency' | 'urgent' | 'elective' | 'outpatient'
type ReferralDecision = 'icu' | 'consult' | 'transfer' | 'observe' | 'discharge'
type FollowupPriority = 'immediate' | 'short' | 'routine'

interface ScaleResult {
  id: string
  name: string
  score: number | string
  max?: number
  level: 'critical' | 'high' | 'moderate' | 'low' | 'normal'
  levelLabel: string
  description: string
  basis: string[]
}

interface ComplexityReason {
  id: string
  category: '医学' | '用药' | '社会' | '其他'
  text: string
}

interface ReferralOption {
  id: ReferralDecision
  label: string
  icon: string
  description: string
  color: string
  bg: string
  border: string
}

interface FollowupItem {
  id: string
  text: string
  priority: FollowupPriority
  detail?: string
}

// ══════════════════════════════════════════════════════
// Mock 数据
// ══════════════════════════════════════════════════════

const MOCK_SCALES: ScaleResult[] = [
  {
    id: 'S001',
    name: 'NYHA 心功能分级',
    score: 'III',
    level: 'high',
    levelLabel: 'III 级',
    description: '轻度体力活动即出现症状，休息时无不适。显著影响日常活动。',
    basis: ['活动后胸闷气短加重', '休息后可缓解', '伴乏力'],
  },
  {
    id: 'S002',
    name: 'Barthel 日常活动指数',
    score: 65,
    max: 100,
    level: 'moderate',
    levelLabel: '中度依赖',
    description: '日常生活部分依赖，需要辅助完成洗浴、穿衣等活动。',
    basis: ['活动耐量下降', '活动后症状明显', '年龄 58 岁'],
  },
  {
    id: 'S003',
    name: 'Morse 跌倒风险',
    score: 55,
    max: 125,
    level: 'high',
    levelLabel: '高风险',
    description: '跌倒高风险，需加强防跌倒措施及床旁护理。',
    basis: ['心血管疾病', 'β阻滞剂致体位性低血压风险', '年龄因素'],
  },
  {
    id: 'S004',
    name: 'GRACE 院内死亡风险',
    score: 142,
    max: 263,
    level: 'high',
    levelLabel: '高危 3–8%',
    description: '院内死亡风险高危，建议早期侵入性策略（24h 内冠脉造影）。',
    basis: ['年龄 58 岁', '心率 88 次/分', '收缩压 158 mmHg', 'ST 段压低'],
  },
]

const COMPLEXITY_LEVEL: ComplexityLevel = 'high'

const COMPLEXITY_REASONS: ComplexityReason[] = [
  { id: 'C001', category: '医学', text: '合并多种慢性疾病：高血压 10 年 + 2 型糖尿病 5 年，靶器官损伤风险高' },
  { id: 'C002', category: '医学', text: '诊断尚未最终确立：hs-cTn 连续检测结果待返回，NSTEMI 未能排除' },
  { id: 'C003', category: '医学', text: 'GRACE 高危（142 分），需早期侵入性策略，心外科协同评估不可缺少' },
  { id: 'C004', category: '用药', text: '多重药物相互作用预警：氯吡格雷 + 奥美拉唑 CYP2C19 抑制，出血/缺血双重风险共存' },
  { id: 'C005', category: '用药', text: 'PRECISE-DAPT 27 分（出血高危），双联抗血小板方案需个体化权衡' },
  { id: 'C006', category: '社会', text: '患者血糖长期控制不佳，入院前依从性欠佳，教育需求高' },
  { id: 'C007', category: '其他', text: '青霉素过敏史限制感染并发症抗生素选择，潜在用药受限' },
  { id: 'C008', category: '其他', text: '患者对病情严重性认知不足，家属支持体系尚未完善评估' },
]

const REFERRAL_OPTIONS: ReferralOption[] = [
  {
    id: 'icu',
    label: '收住 CCU / ICU',
    icon: '🏥',
    description: 'GRACE 高危，建议转入冠心病监护病房行持续心电监护及早期侵入性评估',
    color: '#922b21',
    bg: '#fdedec',
    border: '#e74c3c',
  },
  {
    id: 'consult',
    label: '专科会诊',
    icon: '👨‍⚕️',
    description: '申请心外科会诊（冠脉重建评估）+ 内分泌科会诊（血糖优化）',
    color: '#8e44ad',
    bg: '#f5eef8',
    border: '#d2b4de',
  },
  {
    id: 'transfer',
    label: '转上级医院',
    icon: '🚑',
    description: '如本院导管室资源受限，建议转有 PCI 能力的三甲医院行急诊介入',
    color: '#c0392b',
    bg: '#fef2f0',
    border: '#f1948a',
  },
  {
    id: 'observe',
    label: '留观处置',
    icon: '👁',
    description: '等待 hs-cTn 结果，密切监测，结果返回后重新评估分层',
    color: '#d68910',
    bg: '#fef9ec',
    border: '#f9d78e',
  },
]

const URGENCY_CFG: Record<ReferralUrgency, { label: string; color: string; bg: string; border: string }> = {
  emergency: { label: '急诊（即刻）', color: '#922b21', bg: '#fdedec', border: '#e74c3c' },
  urgent:    { label: '紧急（2h 内）', color: '#c0392b', bg: '#fef2f0', border: '#f1948a' },
  elective:  { label: '择期',         color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  outpatient:{ label: '门诊随访',     color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf' },
}

const FOLLOWUP_IMMEDIATE: FollowupItem[] = [
  {
    id: 'FI001',
    text: '高敏肌钙蛋白 hs-cTn 0h/1h 复查（核心诊断指标）',
    priority: 'immediate',
    detail: '确认/排除 NSTEMI 的唯一决定性指标，结果直接影响诊断升级和治疗策略，预计 2h 内返回',
  },
  {
    id: 'FI002',
    text: '肾功能 + 血钾（ACEI 启用前安全评估）',
    priority: 'immediate',
    detail: '培哚普利启动前必须确认基线肾功能及血钾，血钾 > 5.5 mmol/L 需暂缓用药',
  },
  {
    id: 'FI003',
    text: 'D-二聚体（肺栓塞快速排除）',
    priority: 'immediate',
    detail: '患者有呼吸困难症状，肺栓塞可引起 ECG ST 改变，需快速排除',
  },
  {
    id: 'FI004',
    text: '床旁心脏超声（LVEF 评估）',
    priority: 'immediate',
    detail: 'LVEF < 40% 将改变治疗策略，影响 β阻滞剂及 ACEI 剂量，同时排除瓣膜源性胸痛',
  },
]

const FOLLOWUP_SHORT: FollowupItem[] = [
  {
    id: 'FS001',
    text: '24h 内复查心电图（动态 ST 变化监测）',
    priority: 'short',
    detail: '动态监测 ST 段变化趋势，明确是否进展为 STEMI，辅助判断缺血范围',
  },
  {
    id: 'FS002',
    text: '48h 内复查血钾 + 肌酐（ACEI 启动后评估）',
    priority: 'short',
    detail: '培哚普利启动后 2 周内必须监测，48h 为早期安全评估节点',
  },
  {
    id: 'FS003',
    text: '3 天内申请内分泌科会诊（血糖管理优化）',
    priority: 'short',
    detail: '住院期间血糖目标 7.8–10 mmol/L，优化降糖方案减少心血管事件风险',
  },
  {
    id: 'FS004',
    text: '冠状动脉 CTA 或造影（GRACE 高危手术指征评估）',
    priority: 'short',
    detail: 'ESC 指南推荐 GRACE > 140 分患者 24h 内行侵入性评估，明确冠脉狭窄程度',
  },
]

const FOLLOWUP_MONITOR: FollowupItem[] = [
  {
    id: 'FM001',
    text: '血压监测（每 4h）— 目标 < 140/90 mmHg',
    priority: 'routine',
    detail: 'β阻滞剂 + ACEI 联用可能导致低血压，需警惕体位性低血压',
  },
  {
    id: 'FM002',
    text: '血糖监测（三餐前 + 睡前，4 次/天）',
    priority: 'routine',
    detail: 'β阻滞剂掩盖低血糖症状，强化监测至关重要；空腹目标 < 7.0 mmol/L',
  },
  {
    id: 'FM003',
    text: '心率监测（持续心电监护）— 目标 50–60 次/分',
    priority: 'routine',
    detail: '比索洛尔目标心率 50–60 次/分，避免过度心动过缓（< 45 次/分需调整）',
  },
  {
    id: 'FM004',
    text: '胸痛症状变化（NRS 评分，每班记录）',
    priority: 'routine',
    detail: '症状加重（尤其静息性胸痛）提示病情进展，需立即评估并上报',
  },
  {
    id: 'FM005',
    text: 'HbA1c（出院前或 3 个月后复查）',
    priority: 'routine',
    detail: '他汀类可轻度升高血糖，需与内分泌科共同随访 HbA1c 变化趋势',
  },
]

const FOLLOWUP_EDUCATION: FollowupItem[] = [
  {
    id: 'FE001',
    text: '硝酸甘油正确使用方法（含服，最多 3 次，每次间隔 5 分钟）',
    priority: 'immediate',
    detail: '重点：症状 3 次未缓解立即拨打急救电话，不可擅自增加次数或剂量',
  },
  {
    id: 'FE002',
    text: '胸痛/胸闷加重时立即告知医护人员，勿自行处理',
    priority: 'immediate',
    detail: '强调院内急救流程，床头呼叫铃的正确使用方法，勿强忍不报',
  },
  {
    id: 'FE003',
    text: '低盐低脂饮食教育（钠摄入 < 2g/天，禁高脂肪食物）',
    priority: 'short',
    detail: '配合心脏康复营养师制定个性化食谱，减少心血管再发风险',
  },
  {
    id: 'FE004',
    text: '血糖自我监测技术培训（指尖采血、记录血糖日记）',
    priority: 'short',
    detail: 'β阻滞剂使用期间需掌握出汗异常等非典型低血糖识别方法',
  },
  {
    id: 'FE005',
    text: '抗血小板药物（阿司匹林、氯吡格雷）不可擅自停药',
    priority: 'short',
    detail: '说明停药风险（支架内血栓、心梗），强调遵医嘱按时服药的重要性',
  },
  {
    id: 'FE006',
    text: '出院后随访计划（1 周、1 月、3 月门诊复查）',
    priority: 'routine',
    detail: '告知随访内容：心电图、血脂、血糖、肾功能及药物调整方案',
  },
]

// ══════════════════════════════════════════════════════
// 工具配置
// ══════════════════════════════════════════════════════

const COMPLEXITY_CFG: Record<ComplexityLevel, { label: string; color: string; bg: string; border: string; icon: string }> = {
  high:     { label: '高复杂度', color: '#922b21', bg: '#fdedec', border: '#e74c3c', icon: '🔴' },
  moderate: { label: '中复杂度', color: '#d68910', bg: '#fef9ec', border: '#f9d78e', icon: '🟡' },
  low:      { label: '低复杂度', color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf', icon: '🟢' },
}

const CATEGORY_COLOR: Record<ComplexityReason['category'], { color: string; bg: string }> = {
  '医学': { color: '#2980b9', bg: '#eaf4fd' },
  '用药': { color: '#8e44ad', bg: '#f5eef8' },
  '社会': { color: '#16a085', bg: '#e8f8f5' },
  '其他': { color: '#7f8c8d', bg: '#f2f3f4' },
}

const SCALE_LEVEL_CFG: Record<ScaleResult['level'], { color: string; bg: string; border: string }> = {
  critical: { color: '#922b21', bg: '#fdedec', border: '#e74c3c' },
  high:     { color: '#c0392b', bg: '#fef2f0', border: '#f1948a' },
  moderate: { color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  low:      { color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf' },
  normal:   { color: '#2980b9', bg: '#eaf4fd', border: '#aed6f1' },
}

const FOLLOWUP_PRIORITY_CFG: Record<FollowupPriority, { label: string; color: string; bg: string }> = {
  immediate: { label: '立即', color: '#c0392b', bg: '#fdedec' },
  short:     { label: '近期', color: '#d68910', bg: '#fef9ec' },
  routine:   { label: '常规', color: '#27ae60', bg: '#eafaf1' },
}

// ══════════════════════════════════════════════════════
// 摘要生成
// ══════════════════════════════════════════════════════

function buildAssessmentSummary(
  patientName: string,
  visitId: string,
  selectedDiagnosis: string,
  selectedReferral: ReferralDecision | null,
  referralUrgency: ReferralUrgency,
  confirmed: boolean,
  scales: ScaleResult[] = MOCK_SCALES,
): string {
  const cCfg = COMPLEXITY_CFG[COMPLEXITY_LEVEL]
  const urgCfg = URGENCY_CFG[referralUrgency]
  const refOption = REFERRAL_OPTIONS.find(r => r.id === selectedReferral)

  const scaleLines = scales.map(s =>
    `· ${s.name}：${s.score}${s.max ? '/' + s.max : ''} ${s.levelLabel}`
  ).join('\n')

  const complexityLines = COMPLEXITY_REASONS.map((r, i) =>
    `${i + 1}. [${r.category}] ${r.text}`
  ).join('\n')

  const immediateLines = FOLLOWUP_IMMEDIATE.map(f => `· ${f.text}`).join('\n')
  const shortLines     = FOLLOWUP_SHORT.map(f => `· ${f.text}`).join('\n')
  const monitorLines   = FOLLOWUP_MONITOR.map(f => `· ${f.text}`).join('\n')
  const educationLines = FOLLOWUP_EDUCATION.map(f => `· ${f.text}`).join('\n')

  return [
    '【评估与转诊摘要】',
    `患者：${patientName || '—'}   就诊号：${visitId || '—'}`,
    `当前诊断：${selectedDiagnosis || '不稳定型心绞痛'}`,
    `评估确认状态：${confirmed ? '✓ 已确认' : '待确认'}`,
    '',
    '【量表评估汇总】',
    scaleLines,
    '',
    `【病情复杂度】${cCfg.icon} ${cCfg.label}（${COMPLEXITY_REASONS.length} 项支撑原因）`,
    complexityLines,
    '',
    `【转诊处置建议】${refOption ? refOption.label : '待选择'} — ${urgCfg.label}`,
    refOption ? refOption.description : '',
    '',
    `【建议立即补充的检查（${FOLLOWUP_IMMEDIATE.length} 项）】`,
    immediateLines,
    '',
    `【建议短期观察/复查（${FOLLOWUP_SHORT.length} 项）】`,
    shortLines,
    '',
    `【建议监测内容（${FOLLOWUP_MONITOR.length} 项）】`,
    monitorLines,
    '',
    `【建议患者教育重点（${FOLLOWUP_EDUCATION.length} 项）】`,
    educationLines,
    '',
    `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
  ].join('\n')
}

// ══════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════

export default function AssessmentPage() {
  const {
    selectedDiagnosis, patientContext, parsedEntities,
    showToast, openWritebackModal,
  } = useAppStore()

  // ── API: 量表数据 ──
  const [scales, setScales] = useState<ScaleResult[]>(MOCK_SCALES)

  useEffect(() => {
    const ctx = patientContext ?? {
      patient_id: '', name: '', gender: '', age: 0, department: '',
      visit_id: '', chief_complaint: '', present_illness: '',
      past_history: '', chronic_diseases: [], allergies: [], risk_tags: [],
    }
    fetchAssessmentScales(ctx, parsedEntities, selectedDiagnosis)
      .then(res => {
        if (res.scales?.length) {
          setScales(res.scales.map((s: ApiScaleResult) => ({
            id: s.id,
            name: s.name,
            score: s.score,
            max: s.max,
            level: (s.level as ScaleResult['level']) ?? 'moderate',
            levelLabel: s.levelLabel,
            description: s.description,
            basis: s.basis ?? [],
          })))
        }
      })
      .catch(() => {/* 保持 MOCK_SCALES 作为兜底 */})
  }, [selectedDiagnosis, patientContext, parsedEntities])

  // ── 量表 ──
  const [expandedScale, setExpandedScale] = useState<string | null>(null)

  // ── 复杂度 ──
  const [complexityExpanded, setComplexityExpanded] = useState(true)

  // ── 转诊 ──
  const [selectedReferral, setSelectedReferral] = useState<ReferralDecision | null>(null)
  const [referralUrgency,  setReferralUrgency]  = useState<ReferralUrgency>('urgent')

  // ── 后续建议 ──
  const [expandedFollowupItem, setExpandedFollowupItem] = useState<string | null>(null)

  // ── 摘要 & 输出 ──
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [summaryOpen,      setSummaryOpen]      = useState(false)
  const [copied,           setCopied]           = useState(false)
  const [confirmed,        setConfirmed]        = useState(false)
  const [scalesSaved,      setScalesSaved]      = useState(false)
  const [apiSummary,       setApiSummary]       = useState<string | null>(null)
  const [summaryLoading,   setSummaryLoading]   = useState(false)

  const cCfg   = COMPLEXITY_CFG[COMPLEXITY_LEVEL]
  const urgCfg = URGENCY_CFG[referralUrgency]
  const categories = ['医学', '用药', '社会', '其他'] as const

  // 本地摘要作为 API 失败时的兜底
  const localSummary = useMemo(() => buildAssessmentSummary(
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
    selectedDiagnosis,
    selectedReferral,
    referralUrgency,
    confirmed,
    scales,
  ), [patientContext, selectedDiagnosis, selectedReferral, referralUrgency, confirmed, scales])

  const summary = apiSummary ?? localSummary

  const handleCopy = () => {
    navigator.clipboard.writeText(summary)
      .then(() => {
        setCopied(true)
        showToast('评估摘要已复制到剪贴板', 'info')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  const handleConfirm = () => {
    if (!selectedReferral) { showToast('请先选择转诊/处置方案', 'error'); return }
    setConfirmed(true)
    showToast('评估结果已确认', 'success')
  }

  const handleSaveScales = () => {
    setScalesSaved(true)
    showToast('量表结果已保存至病历系统', 'success')
  }

  // ── 通用：后续建议列表渲染 ──
  const renderFollowupList = (items: FollowupItem[]) => (
    <div className="as-followup-list">
      {items.map(item => {
        const pCfg   = FOLLOWUP_PRIORITY_CFG[item.priority]
        const isOpen = expandedFollowupItem === item.id
        return (
          <div
            key={item.id}
            className={`as-followup-row ${isOpen ? 'open' : ''} ${item.detail ? 'has-detail' : ''}`}
            onClick={() => item.detail && setExpandedFollowupItem(isOpen ? null : item.id)}
          >
            <div className="as-followup-main">
              <span className="as-followup-priority" style={{ color: pCfg.color, background: pCfg.bg }}>
                {pCfg.label}
              </span>
              <span className="as-followup-text">{item.text}</span>
              {item.detail && (
                <span className={`as-expand-chevron ${isOpen ? 'open' : ''}`}>›</span>
              )}
            </div>
            {isOpen && item.detail && (
              <div className="as-followup-detail">{item.detail}</div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="page as-page">

      {/* ── 页头 ── */}
      <div className="as-header">
        <div className="as-header-left">
          <span className="as-page-icon">🔀</span>
          <div>
            <div className="as-page-title">评估与转诊</div>
            <div className="as-page-sub">
              量表评估 · 复杂度分层 · 转诊推荐 · 后续处理建议
            </div>
          </div>
        </div>
        <div className="as-header-badges">
          <span className="as-badge" style={{ color: cCfg.color, background: cCfg.bg, borderColor: cCfg.border }}>
            {cCfg.icon} {cCfg.label}
          </span>
          <span className="as-badge" style={{ color: urgCfg.color, background: urgCfg.bg, borderColor: urgCfg.border }}>
            {urgCfg.label}
          </span>
          {confirmed && <span className="as-badge-confirmed">✓ 已确认</span>}
        </div>
      </div>

      <div className="as-body">

        {/* ════════════════════════════
            ① 量表评估结果
            ════════════════════════════ */}
        <div className="as-section">
          <div className="as-sec-title">
            量表评估结果
            <span className="as-count-badge">{scales.length} 项</span>
            {scalesSaved && <span className="as-saved-tag">✓ 已保存</span>}
          </div>
          <div className="as-scale-grid">
            {scales.map(scale => {
              const lCfg   = SCALE_LEVEL_CFG[scale.level]
              const isOpen = expandedScale === scale.id
              const pct    = scale.max ? Math.round((Number(scale.score) / scale.max) * 100) : null
              return (
                <div
                  key={scale.id}
                  className={`as-scale-card ${isOpen ? 'open' : ''}`}
                  style={{ borderColor: isOpen ? lCfg.border : undefined }}
                  onClick={() => setExpandedScale(isOpen ? null : scale.id)}
                >
                  <div className="as-scale-header">
                    <div className="as-scale-top">
                      <span className="as-scale-name">{scale.name}</span>
                      <span
                        className="as-scale-level"
                        style={{ color: lCfg.color, background: lCfg.bg, borderColor: lCfg.border }}
                      >{scale.levelLabel}</span>
                    </div>
                    <div className="as-scale-score-row">
                      <span className="as-scale-score" style={{ color: lCfg.color }}>
                        {scale.score}
                        {scale.max && <span className="as-scale-max"> / {scale.max}</span>}
                      </span>
                      {pct !== null && (
                        <div className="as-scale-bar-wrap">
                          <div className="as-scale-bar-fill" style={{ width: `${pct}%`, background: lCfg.border }} />
                        </div>
                      )}
                      <span className={`as-expand-chevron ${isOpen ? 'open' : ''}`}>›</span>
                    </div>
                    <div className="as-scale-desc">{scale.description}</div>
                  </div>
                  {isOpen && (
                    <div className="as-scale-detail">
                      <div className="as-detail-label">评分依据</div>
                      <div className="as-basis-list">
                        {scale.basis.map((b, i) => (
                          <div key={i} className="as-basis-item">
                            <span className="as-basis-dot" style={{ background: lCfg.border }} />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ════════════════════════════
            ② 病情复杂度评估（含其他支撑原因）
            ════════════════════════════ */}
        <div className="as-section">
          <div
            className="as-sec-title as-clickable"
            onClick={() => setComplexityExpanded(v => !v)}
          >
            病情复杂度评估
            <span
              className="as-complexity-badge"
              style={{ color: cCfg.color, background: cCfg.bg, borderColor: cCfg.border }}
            >
              {cCfg.icon} {cCfg.label}
            </span>
            <span className="as-count-badge">{COMPLEXITY_REASONS.length} 项</span>
            <span className={`as-expand-chevron ${complexityExpanded ? 'open' : ''}`} style={{ marginLeft: 'auto' }}>›</span>
          </div>

          {complexityExpanded && (
            <>
              {categories.map(cat => {
                const catReasons = COMPLEXITY_REASONS.filter(r => r.category === cat)
                if (catReasons.length === 0) return null
                const catColor = CATEGORY_COLOR[cat]
                return (
                  <div key={cat} className="as-reason-group">
                    <div className="as-reason-cat-label" style={{ color: catColor.color }}>
                      <span className="as-cat-dot" style={{ background: catColor.color }} />
                      {cat}类原因
                    </div>
                    <div className="as-reason-list">
                      {catReasons.map(reason => (
                        <div
                          key={reason.id}
                          className="as-reason-row"
                          style={{ borderLeftColor: catColor.color }}
                        >
                          <span
                            className="as-reason-cat"
                            style={{ color: catColor.color, background: catColor.bg }}
                          >{cat}</span>
                          <span className="as-reason-text">{reason.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* 其他支撑原因 — 医生手动补充 */}
              <div className="as-other-reason-box">
                <div className="as-other-reason-label">
                  <span className="as-cat-dot" style={{ background: '#7f8c8d' }} />
                  其他支撑原因（医生补充）
                </div>
                <textarea
                  className="as-other-reason-input"
                  placeholder="如有其他影响复杂度的原因，请在此补充说明…"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════
            ③ 转诊处置建议
            ════════════════════════════ */}
        <div className="as-section">
          <div className="as-sec-title">转诊 / 处置方案</div>

          <div className="as-urgency-row">
            <span className="as-urgency-label">紧急程度：</span>
            {(Object.keys(URGENCY_CFG) as ReferralUrgency[]).map(u => {
              const uCfg = URGENCY_CFG[u]
              return (
                <button
                  key={u}
                  className={`as-urgency-btn ${referralUrgency === u ? 'active' : ''}`}
                  style={referralUrgency === u
                    ? { color: uCfg.color, background: uCfg.bg, borderColor: uCfg.border }
                    : undefined}
                  onClick={() => setReferralUrgency(u)}
                >
                  {uCfg.label}
                </button>
              )
            })}
          </div>

          <div className="as-referral-list">
            {REFERRAL_OPTIONS.map(opt => (
              <div
                key={opt.id}
                className={`as-referral-card ${selectedReferral === opt.id ? 'selected' : ''}`}
                style={selectedReferral === opt.id
                  ? { borderColor: opt.border, background: opt.bg }
                  : undefined}
                onClick={() => setSelectedReferral(opt.id)}
              >
                <div className="as-referral-header">
                  <span className="as-referral-icon">{opt.icon}</span>
                  <span
                    className="as-referral-label"
                    style={selectedReferral === opt.id ? { color: opt.color } : undefined}
                  >{opt.label}</span>
                  {selectedReferral === opt.id && (
                    <span className="as-referral-check" style={{ color: opt.color }}>✓ 已选</span>
                  )}
                </div>
                <div className="as-referral-desc">{opt.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════
            ④  8. 后续处理建议
            ════════════════════════════ */}
        <div className="as-section">
          <div className="as-sec-title">
            后续处理建议
            <span className="as-count-badge">
              {FOLLOWUP_IMMEDIATE.length + FOLLOWUP_SHORT.length + FOLLOWUP_MONITOR.length + FOLLOWUP_EDUCATION.length} 项
            </span>
          </div>

          {/* 8-1 建议立即补充的检查 */}
          <div className="as-followup-block">
            <div className="as-followup-block-title">
              <span className="as-fblock-icon">🔬</span>
              建议立即补充的检查
              <span className="as-fcount red">{FOLLOWUP_IMMEDIATE.length} 项</span>
            </div>
            {renderFollowupList(FOLLOWUP_IMMEDIATE)}
          </div>

          {/* 8-2 建议短期观察/复查 */}
          <div className="as-followup-block">
            <div className="as-followup-block-title">
              <span className="as-fblock-icon">📅</span>
              建议短期观察 / 复查
              <span className="as-fcount orange">{FOLLOWUP_SHORT.length} 项</span>
            </div>
            {renderFollowupList(FOLLOWUP_SHORT)}
          </div>

          {/* 8-3 建议监测内容 */}
          <div className="as-followup-block">
            <div className="as-followup-block-title">
              <span className="as-fblock-icon">📈</span>
              建议监测内容
              <span className="as-fcount blue">{FOLLOWUP_MONITOR.length} 项</span>
            </div>
            {renderFollowupList(FOLLOWUP_MONITOR)}
          </div>

          {/* 8-4 建议患者教育重点 */}
          <div className="as-followup-block">
            <div className="as-followup-block-title">
              <span className="as-fblock-icon">📚</span>
              建议患者教育重点
              <span className="as-fcount green">{FOLLOWUP_EDUCATION.length} 项</span>
            </div>
            {renderFollowupList(FOLLOWUP_EDUCATION)}
          </div>
        </div>

        {/* ════════════════════════════
            ⑤  9. 生成评估与转诊摘要
            ════════════════════════════ */}
        <div className="as-section as-summary-section">
          <div className="as-summary-header">
            <div className="as-sec-title" style={{ margin: 0 }}>评估与转诊摘要</div>
            <div className="as-summary-header-actions">
              {!summaryGenerated ? (
                <button
                  className="as-btn-generate"
                  disabled={summaryLoading}
                  onClick={() => {
                    setSummaryLoading(true)
                    generateAssessmentSummary({
                      patient_context: patientContext ?? {},
                      diagnosis: selectedDiagnosis,
                      scales: scales.map(s => ({ name: s.name, score: s.score, levelLabel: s.levelLabel })),
                      risk_scores: [],
                      referral_decision: selectedReferral ?? '',
                      referral_urgency: referralUrgency,
                    })
                      .then(res => { setApiSummary(res.summary) })
                      .catch(() => {/* 使用本地摘要兜底 */})
                      .finally(() => { setSummaryLoading(false); setSummaryGenerated(true); setSummaryOpen(true) })
                  }}
                >
                  {summaryLoading ? '生成中…' : '一键生成摘要'}
                </button>
              ) : (
                <button
                  className="as-btn-toggle"
                  onClick={() => setSummaryOpen(v => !v)}
                >
                  {summaryOpen ? '收起' : '展开'}
                </button>
              )}
            </div>
          </div>

          {summaryGenerated && summaryOpen && (
            <>
              <pre className="as-summary-text">{summary}</pre>
              <div className="as-summary-actions">
                <button className="as-btn-copy" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '复制摘要'}
                </button>
                <button className="as-btn-writeback-preview" onClick={openWritebackModal}>
                  回写 HIS 预览
                </button>
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════
            ⑥  10. 输出与确认
            ════════════════════════════ */}
        <div className="as-action-section">
          {confirmed ? (
            <div className="as-confirmed-bar">
              <span className="as-confirmed-check">✓</span>
              <span>
                评估结果已确认
                {scalesSaved && ' · 量表已保存'}
              </span>
              <button
                className="as-btn-ghost-sm"
                onClick={() => setConfirmed(false)}
              >撤销确认</button>
            </div>
          ) : (
            <div className="as-action-row">
              <button className="as-btn-confirm" onClick={handleConfirm}>
                确认评估结果
              </button>
              <button
                className="as-btn-save"
                onClick={handleSaveScales}
                disabled={scalesSaved}
              >
                {scalesSaved ? '✓ 量表已保存' : '保存量表结果'}
              </button>
              <button className="as-btn-writeback-main" onClick={openWritebackModal}>
                回写 HIS
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
