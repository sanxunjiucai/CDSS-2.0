import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store'
import { interpretLabResults } from '../api/endpoints'
import type { LabResult as ApiLabResult } from '../api/endpoints'
import './common.css'
import './LabResultsPage.css'

// ══════════════════════════════════════════════════════
// 类型
// ══════════════════════════════════════════════════════

type ResultStatus    = 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low'
type ResultCategory  = '实验室检验' | '影像检查' | '功能检查'
type DiagnosisImpact = 'support' | 'challenge' | 'upgrade' | 'neutral'
type FilterTab       = 'all' | 'abnormal' | 'critical'
type ActionType      = 'exam' | 'recheck' | 'diagnosis' | 'treatment'

interface LabResult {
  test_id: string
  category: ResultCategory
  name: string
  value: string
  numeric_value?: number
  unit: string
  ref_range: string
  ref_min?: number
  ref_max?: number
  status: ResultStatus
  delta?: string
  collected_at: string
  clinical_note: string
  diagnosis_impact: DiagnosisImpact
  impact_detail: string
  treatment_note?: string
  related_tags: string[]
  immediate_action?: string   // 危急值需立即处理的操作
}

interface DiagnosisAlert {
  level: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  action: string
}

interface ActionRecommendation {
  type: ActionType
  content: string
  priority: 'urgent' | 'recommended' | 'optional'
  target_step?: 'diagnosis' | 'personalized-treatment' | 'tests' | 'risk'
  target_label?: string
}

interface LinkageItem {
  step: 'diagnosis' | 'personalized-treatment' | 'risk'
  icon: string
  label: string
  desc: string
  count: number
  color: string
  bg: string
  border: string
}

// ══════════════════════════════════════════════════════
// HIS 数据源层
// 以下为模拟从 HIS 注入的原始检验结果。
// 生产环境应替换为真实 HIS 数据接口。
// 解读注释（clinical_note）和诊断预警由 /api/lab-results/interpret 覆盖。
// ══════════════════════════════════════════════════════

const MOCK_RESULTS: LabResult[] = [
  {
    test_id: 'L002',
    category: '实验室检验',
    name: '高敏肌钙蛋白 I（hs-cTnI）',
    value: '0.086',
    numeric_value: 0.086,
    unit: 'ng/mL',
    ref_range: '< 0.040',
    ref_max: 0.040,
    status: 'high',
    delta: '↑（1h Δ = 0.032，超过 ESC 阈值）',
    collected_at: '08:00 / 09:02',
    clinical_note: '0h 值 0.054 ng/mL，1h 复查 0.086 ng/mL，Δ 值 0.032 超过 ESC 快速方案 1h 阈值（0.006 ng/mL），确认心肌损伤标志物阳性。',
    diagnosis_impact: 'upgrade',
    impact_detail: '按 ESC 0h/1h 快速诊断方案，hs-cTnI 连续升高确认心肌损伤，当前"不稳定型心绞痛"应升级为 NSTEMI（非 ST 段抬高型心肌梗死）。',
    treatment_note: '诊断升级为 NSTEMI 后，需评估是否将氯吡格雷升级为替格瑞洛（更强效 P2Y12 抑制剂），并讨论早期侵入性策略（24h 内行冠脉造影）。',
    related_tags: ['NSTEMI', 'ACS', '心肌损伤'],
  },
  {
    test_id: 'L001a',
    category: '实验室检验',
    name: 'CK-MB（肌酸激酶同工酶）',
    value: '32',
    numeric_value: 32,
    unit: 'U/L',
    ref_range: '0–25',
    ref_max: 25,
    status: 'high',
    collected_at: '08:00',
    clinical_note: 'CK-MB 轻度升高，与 hs-cTnI 同步升高，进一步支持心肌损伤诊断。CK-MB/CK 比值有助于判断心肌来源损伤。',
    diagnosis_impact: 'support',
    impact_detail: '与 hs-cTnI 结果一致，强化 NSTEMI 诊断依据。',
    related_tags: ['心肌损伤', 'ACS'],
  },
  {
    test_id: 'L003',
    category: '实验室检验',
    name: 'NT-proBNP',
    value: '780',
    numeric_value: 780,
    unit: 'pg/mL',
    ref_range: '< 125（< 75 岁）',
    ref_max: 125,
    status: 'high',
    collected_at: '08:00',
    clinical_note: 'NT-proBNP 明显升高（> 6 倍正常上限），提示心功能受损或心室负荷增加。需心脏超声确认 LVEF，排除急性心力衰竭。',
    diagnosis_impact: 'challenge',
    impact_detail: '高 BNP 提示不仅存在心肌缺血，可能合并心功能不全；若 LVEF < 40%，治疗策略需相应调整（ACEI 剂量、利尿剂）。',
    treatment_note: '建议加速完成心脏超声；如确认 HFrEF，需考虑上调 ACEI 剂量或讨论 ARNI 替代。',
    related_tags: ['心功能', '心力衰竭', 'BNP'],
  },
  {
    test_id: 'L007c',
    category: '实验室检验',
    name: '血钾（K⁺）— ACEI 启用后复查',
    value: '6.1',
    numeric_value: 6.1,
    unit: 'mmol/L',
    ref_range: '3.5–5.0',
    ref_min: 3.5,
    ref_max: 5.0,
    status: 'critical_high',
    delta: '↑ 1.8（较基线 4.3 mmol/L 显著升高）',
    collected_at: '（2 周复查）',
    clinical_note: '培哚普利启用 2 周后复查，血钾 6.1 mmol/L，达危急值（> 6.0 mmol/L），存在高钾血症导致恶性心律失常风险，需立即处理。',
    diagnosis_impact: 'challenge',
    impact_detail: '高钾血症是 ACEI 已知并发症，提示需立即暂停 ACEI，紧急评估是否需要降钾治疗（葡萄糖酸钙、胰岛素葡萄糖）。',
    treatment_note: '立即暂停培哚普利；评估是否需葡萄糖酸钙静注保护心肌；复查 ECG 排除高钾相关心律失常；内分泌科会诊。',
    related_tags: ['高钾血症', 'ACEI', '危急值', '心律失常风险'],
    immediate_action: '立即暂停培哚普利，复查 ECG，考虑紧急降钾处理',
  },
  {
    test_id: 'L005a',
    category: '实验室检验',
    name: '空腹血糖（FBG）',
    value: '9.8',
    numeric_value: 9.8,
    unit: 'mmol/L',
    ref_range: '3.9–6.1',
    ref_min: 3.9,
    ref_max: 6.1,
    status: 'high',
    collected_at: '08:00',
    clinical_note: '空腹血糖 9.8 mmol/L，明显高于目标（< 7.0 mmol/L），印证血糖控制不佳，住院期间目标 7.8–10.0 mmol/L。',
    diagnosis_impact: 'support',
    impact_detail: '验证了个性化治疗中血糖控制不佳的用药调整依据（比索洛尔替代美托洛尔、他汀维持剂量）。',
    treatment_note: '血糖监测：三餐前 + 睡前；评估是否需临时胰岛素强化。',
    related_tags: ['血糖控制', '糖尿病', '个性化治疗'],
  },
  {
    test_id: 'L005b',
    category: '实验室检验',
    name: 'HbA1c（糖化血红蛋白）',
    value: '8.4',
    numeric_value: 8.4,
    unit: '%',
    ref_range: '< 7.0',
    ref_max: 7.0,
    status: 'high',
    collected_at: '08:00',
    clinical_note: 'HbA1c 8.4%，近 3 月平均血糖明显偏高，目标 < 7.0%。提示长期血糖管理不足，需内分泌科协同介入。',
    diagnosis_impact: 'support',
    impact_detail: 'HbA1c 每升高 1%，心血管风险增加约 18%，与当前 ACS 发病高度相关。',
    related_tags: ['血糖控制', '长期管理', 'HbA1c'],
  },
  {
    test_id: 'L004a',
    category: '实验室检验',
    name: 'LDL-C（低密度脂蛋白胆固醇）',
    value: '3.62',
    numeric_value: 3.62,
    unit: 'mmol/L',
    ref_range: '< 1.8（ACS 患者）',
    ref_max: 1.8,
    status: 'high',
    collected_at: '08:00',
    clinical_note: 'LDL-C 3.62 mmol/L，ACS 目标 < 1.8 mmol/L，当前值为目标的 2 倍，他汀强化有充分空间。',
    diagnosis_impact: 'support',
    impact_detail: '高 LDL-C 是冠脉粥样硬化核心危险因素，支持 ACS 病理基础，提示他汀剂量可能需上调。',
    treatment_note: '待血糖改善后评估是否升级至阿托伐他汀 40mg 或换用瑞舒伐他汀。',
    related_tags: ['血脂', 'LDL-C', '他汀治疗'],
  },
  {
    test_id: 'L007a',
    category: '实验室检验',
    name: '血钾（K⁺）— 基线',
    value: '4.3',
    numeric_value: 4.3,
    unit: 'mmol/L',
    ref_range: '3.5–5.0',
    ref_min: 3.5,
    ref_max: 5.0,
    status: 'normal',
    collected_at: '08:00',
    clinical_note: '基线血钾 4.3 mmol/L，正常。ACEI 启用后 2 周复查显示升至 6.1（危急值），需立即干预。',
    diagnosis_impact: 'neutral',
    impact_detail: '基线正常，但 ACEI 启用后出现高钾，需重新评估用药方案。',
    related_tags: ['ACEI', '电解质', '安全监测'],
  },
  {
    test_id: 'L007b',
    category: '实验室检验',
    name: '血清肌酐（Cr）',
    value: '86',
    numeric_value: 86,
    unit: 'μmol/L',
    ref_range: '59–104',
    ref_min: 59,
    ref_max: 104,
    status: 'normal',
    collected_at: '08:00',
    clinical_note: '肌酐 86 μmol/L，eGFR > 60 mL/min/1.73m²，肾功能正常，ACEI 启用安全。',
    diagnosis_impact: 'neutral',
    impact_detail: '肾功能正常，GRACE 评分肌酐因子属低分区间。',
    related_tags: ['肾功能', 'ACEI', 'GRACE评分'],
  },
  {
    test_id: 'L006a',
    category: '实验室检验',
    name: 'ALT（谷丙转氨酶）',
    value: '38',
    numeric_value: 38,
    unit: 'U/L',
    ref_range: '7–40',
    ref_min: 7,
    ref_max: 40,
    status: 'normal',
    collected_at: '08:00',
    clinical_note: 'ALT 38 U/L，正常上限边缘。他汀停药阈值 ALT > 3×ULN（120 U/L），当前远低于阈值。',
    diagnosis_impact: 'neutral',
    impact_detail: '肝功能正常，他汀可安全使用。',
    related_tags: ['肝功能', '他汀监测'],
  },
  {
    test_id: 'F001',
    category: '功能检查',
    name: '12 导联心电图',
    value: 'ST 段压低',
    unit: '',
    ref_range: '正常 ST 段',
    status: 'high',
    collected_at: '07:45',
    clinical_note: 'II、III、aVF 导联 ST 段水平型压低 1.0–1.5 mm，V4–V6 导联 T 波低平，广泛心内膜下缺血模式，与 8h 前对比无改善。',
    diagnosis_impact: 'support',
    impact_detail: '持续 ST 压低 > 8h，结合 hs-cTnI 升高确认 NSTEMI 诊断。',
    related_tags: ['ECG', 'ST段', 'ACS'],
  },
]

const MOCK_ACTION_RECS: ActionRecommendation[] = [
  // 建议补充检查
  { type: 'exam', priority: 'urgent',      content: '心脏彩超（超声心动图）— 明确 LVEF，NT-proBNP 升高需评估心功能',           target_step: 'tests', target_label: '前往检验检查' },
  { type: 'exam', priority: 'urgent',      content: 'D-二聚体 — 患者有呼吸困难，快速排除肺栓塞',                              target_step: 'tests', target_label: '前往检验检查' },
  { type: 'exam', priority: 'recommended', content: '冠状动脉 CTA — 明确冠脉狭窄程度，为介入决策提供解剖依据',               target_step: 'tests', target_label: '前往检验检查' },
  // 建议复查
  { type: 'recheck', priority: 'urgent',      content: '血钾（K⁺）— 已达危急值 6.1 mmol/L，暂停 ACEI 后立即复查',            },
  { type: 'recheck', priority: 'recommended', content: 'hs-cTnI 4h 后再次复查 — 评估心肌损伤是否持续进展（峰值追踪）',        },
  { type: 'recheck', priority: 'recommended', content: 'HbA1c（3 个月后）— 评估降糖干预效果',                                 },
  // 建议重新评估诊断方向
  { type: 'diagnosis', priority: 'urgent',      content: '立即修正诊断为 NSTEMI — hs-cTnI 0h/1h 方案阳性，ESC 诊断确认', target_step: 'diagnosis', target_label: '前往辅助诊断' },
  { type: 'diagnosis', priority: 'recommended', content: '排除合并心力衰竭 — NT-proBNP 780 pg/mL，等待心脏超声结果',       target_step: 'diagnosis', target_label: '前往辅助诊断' },
  { type: 'diagnosis', priority: 'recommended', content: '重新评估肺栓塞可能性 — 合并呼吸困难 + D-二聚体未查',              },
  // 建议调整治疗关注点
  { type: 'treatment', priority: 'urgent',      content: '立即暂停 ACEI（培哚普利）— 血钾 6.1 mmol/L 危急值',               target_step: 'personalized-treatment', target_label: '查看个性化治疗' },
  { type: 'treatment', priority: 'urgent',      content: '评估抗栓策略升级 — 诊断升级为 NSTEMI 后考虑替格瑞洛替代氯吡格雷', target_step: 'personalized-treatment', target_label: '查看个性化治疗' },
  { type: 'treatment', priority: 'recommended', content: '他汀剂量评估 — LDL-C 3.62 mmol/L（目标 < 1.8），血糖改善后强化', target_step: 'personalized-treatment', target_label: '查看个性化治疗' },
]

const MOCK_LINKAGE: LinkageItem[] = [
  {
    step: 'diagnosis',
    icon: '⚕',
    label: '辅助诊断',
    desc: 'hs-cTnI 升高确认心肌损伤，诊断建议修正为 NSTEMI，点击前往更新',
    count: 2,
    color: '#c0392b',
    bg: '#fdedec',
    border: '#f1948a',
  },
  {
    step: 'personalized-treatment',
    icon: '★',
    label: '个性化治疗',
    desc: '血钾危急值影响 ACEI 方案，BNP 升高影响治疗策略，3 项调整建议待处理',
    count: 3,
    color: '#d68910',
    bg: '#fef9ec',
    border: '#f9d78e',
  },
  {
    step: 'risk',
    icon: '⚑',
    label: '风险审核',
    desc: '6 项异常结果（含 1 项危急值）已推送至风险审核模块，点击查看综合评估',
    count: 6,
    color: '#2980b9',
    bg: '#eaf4fd',
    border: '#aed6f1',
  },
]

// ══════════════════════════════════════════════════════
// 工具配置
// ══════════════════════════════════════════════════════

const STATUS_CFG: Record<ResultStatus, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  normal:        { label: '正常',   color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf', barColor: '#27ae60' },
  high:          { label: '偏高',   color: '#d68910', bg: '#fef9ec', border: '#f9d78e', barColor: '#f39c12' },
  low:           { label: '偏低',   color: '#2980b9', bg: '#eaf4fd', border: '#aed6f1', barColor: '#3498db' },
  critical_high: { label: '危急↑', color: '#922b21', bg: '#fdedec', border: '#e74c3c', barColor: '#c0392b' },
  critical_low:  { label: '危急↓', color: '#6c3483', bg: '#f5eef8', border: '#d2b4de', barColor: '#8e44ad' },
}

const IMPACT_CFG: Record<DiagnosisImpact, { label: string; color: string; bg: string; icon: string }> = {
  upgrade:  { label: '触发诊断升级', color: '#c0392b', bg: '#fdedec', icon: '🔺' },
  challenge:{ label: '挑战当前诊断', color: '#d68910', bg: '#fef9ec', icon: '⚡' },
  support:  { label: '支持当前诊断', color: '#27ae60', bg: '#eafaf1', icon: '✓' },
  neutral:  { label: '中性',         color: '#8a9fb4', bg: '#f0f7fc', icon: '—' },
}

const ALERT_LEVEL_CFG = {
  critical: { color: '#c0392b', bg: '#fdedec', border: '#e74c3c' },
  warning:  { color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  info:     { color: '#2980b9', bg: '#eaf4fd', border: '#aed6f1' },
}

const ACTION_CFG: Record<ActionType, { label: string; icon: string; color: string; bg: string }> = {
  exam:      { label: '建议补充检查',     icon: '🔬', color: '#2980b9', bg: '#eaf4fd' },
  recheck:   { label: '建议复查',         icon: '🔄', color: '#8e44ad', bg: '#f5eef8' },
  diagnosis: { label: '建议重新评估诊断', icon: '⚕',  color: '#c0392b', bg: '#fdedec' },
  treatment: { label: '建议调整治疗',     icon: '💊', color: '#d68910', bg: '#fef9ec' },
}

const PRIORITY_CFG: Record<ActionRecommendation['priority'], { label: string; color: string }> = {
  urgent:      { label: '紧急', color: '#c0392b' },
  recommended: { label: '建议', color: '#d68910' },
  optional:    { label: '可选', color: '#5d8a9e' },
}

const CATEGORY_ORDER: ResultCategory[] = ['实验室检验', '影像检查', '功能检查']
const ACTION_TYPES: ActionType[]       = ['exam', 'recheck', 'diagnosis', 'treatment']

// ── 参考范围进度条 ─────────────────────────────────────

function calcBarPct(result: LabResult): number | null {
  if (result.numeric_value == null || result.ref_min == null || result.ref_max == null) return null
  const range = result.ref_max - result.ref_min
  const pos   = (result.numeric_value - result.ref_min) / range
  return Math.max(0, Math.min(1.5, pos)) * 100   // allow slightly over 100 to show OOB
}

// ── 摘要生成 ──────────────────────────────────────────

function buildSummary(
  results: LabResult[],
  diagnosis: string,
  patientName: string,
  visitId: string,
): string {
  const abnormal   = results.filter(r => r.status !== 'normal')
  const critical   = results.filter(r => r.status === 'critical_high' || r.status === 'critical_low')
  const upgrades   = results.filter(r => r.diagnosis_impact === 'upgrade')
  const challenges = results.filter(r => r.diagnosis_impact === 'challenge')
  const urgentActs = MOCK_ACTION_RECS.filter(a => a.priority === 'urgent')

  const criticalLines = critical.map(r =>
    `🚨 [危急值] ${r.name}：${r.value} ${r.unit}（参考 ${r.ref_range}）\n  解读：${r.clinical_note}\n  立即处理：${r.immediate_action ?? '联系主管医生'}`
  ).join('\n')

  const abnLines = abnormal.filter(r => r.status !== 'critical_high' && r.status !== 'critical_low').map(r =>
    `[${STATUS_CFG[r.status].label}] ${r.name}：${r.value} ${r.unit}（参考 ${r.ref_range}）\n  解读：${r.clinical_note}`
  ).join('\n')

  const normalLines = results.filter(r => r.status === 'normal').map(r =>
    `· ${r.name}：${r.value} ${r.unit} ✓`
  ).join('\n')

  const impactLines = results.filter(r => r.diagnosis_impact !== 'neutral').map(r =>
    `[${IMPACT_CFG[r.diagnosis_impact].label}] ${r.name}\n  ${r.impact_detail}`
  ).join('\n')

  const actLines = ACTION_TYPES.map(type => {
    const items = MOCK_ACTION_RECS.filter(a => a.type === type)
    if (items.length === 0) return ''
    return `【${ACTION_CFG[type].label}】\n` +
      items.map(a => `· [${PRIORITY_CFG[a.priority].label}] ${a.content}`).join('\n')
  }).filter(Boolean).join('\n')

  return [
    '【检验结果解读报告】',
    `患者：${patientName || '—'}   就诊号：${visitId || '—'}`,
    `当前诊断：${diagnosis || '（待确认）'}`,
    `报告生成：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    `【结果概要】共 ${results.length} 项`,
    `· 危急值 ${critical.length} 项 / 异常 ${abnormal.length} 项 / 正常 ${results.length - abnormal.length} 项`,
    `· 触发诊断升级 ${upgrades.length} 项 / 挑战诊断 ${challenges.length} 项`,
    `· 紧急行动建议 ${urgentActs.length} 项`,
    '',
    ...(critical.length > 0 ? ['【🚨 危急值 — 需立即处理】', criticalLines, ''] : []),
    '【异常结果详情】',
    abnLines || '（无其他异常）',
    '',
    '【正常结果】',
    normalLines || '（无）',
    '',
    '【诊断影响分析】',
    impactLines || '（无特殊影响）',
    '',
    '【行动建议】',
    actLines,
  ].join('\n')
}

// ══════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════

export default function LabResultsPage() {
  const {
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal, setCurrentStep,
  } = useAppStore()

  const [filterTab,        setFilterTab]        = useState<FilterTab>('all')
  const [expandedResult,   setExpandedResult]   = useState<string | null>(null)
  const [reviewedAll,      setReviewedAll]      = useState(false)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [summaryOpen,      setSummaryOpen]      = useState(false)
  const [copied,           setCopied]           = useState(false)
  const [commentMap,       setCommentMap]       = useState<Record<string, string>>({})
  // diagnosisAlerts 完全由 /api/lab-results/interpret 驱动，不使用本地 Mock
  const [diagnosisAlerts,  setDiagnosisAlerts]  = useState<DiagnosisAlert[]>([])

  useEffect(() => {
    const apiResults: ApiLabResult[] = MOCK_RESULTS.map(r => ({
      test_id: r.test_id,
      test_name: r.name,
      value: r.value,
      unit: r.unit,
      reference_range: r.ref_range,
      status: (r.status === 'critical_high' || r.status === 'critical_low') ? 'critical' : r.status,
    }))
    interpretLabResults(apiResults)
      .then(res => {
        const map: Record<string, string> = {}
        res.results.forEach(ir => { map[ir.test_id] = ir.comment })
        setCommentMap(map)
        // 始终用 API 结果覆盖（空列表也表示无预警）
        setDiagnosisAlerts((res.alerts ?? []).map(a => ({
          level: (a.status === 'critical' ? 'critical' : a.status === 'high' ? 'warning' : 'info') as DiagnosisAlert['level'],
          title: `${a.test_name} — ${a.message}`,
          detail: a.message,
          action: '',
        })))
      })
      .catch(err => console.error('interpretLabResults failed', err))
  }, [])

  const criticalResults = MOCK_RESULTS.filter(r => r.status === 'critical_high' || r.status === 'critical_low')
  const abnormalCount   = MOCK_RESULTS.filter(r => r.status !== 'normal').length
  const criticalCount   = criticalResults.length
  const upgradeCount    = MOCK_RESULTS.filter(r => r.diagnosis_impact === 'upgrade').length
  const urgentActCount  = MOCK_ACTION_RECS.filter(a => a.priority === 'urgent').length

  const filteredResults = useMemo(() => {
    if (filterTab === 'abnormal') return MOCK_RESULTS.filter(r => r.status !== 'normal')
    if (filterTab === 'critical') return MOCK_RESULTS.filter(r => r.status === 'critical_high' || r.status === 'critical_low')
    return MOCK_RESULTS
  }, [filterTab])

  const byCategory = useMemo(() =>
    CATEGORY_ORDER.reduce<Record<ResultCategory, LabResult[]>>((acc, cat) => {
      acc[cat] = filteredResults.filter(r => r.category === cat)
      return acc
    }, {} as Record<ResultCategory, LabResult[]>),
  [filteredResults])

  const summary = useMemo(() => buildSummary(
    MOCK_RESULTS,
    selectedDiagnosis,
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
  ), [selectedDiagnosis, patientContext])

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      showToast('解读报告已复制到剪贴板', 'info')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  return (
    <div className="page lr-page">

      {/* ════════════════ 页头 ════════════════ */}
      <div className="lr-header">
        <div className="lr-header-left">
          <span className="lr-page-icon">📋</span>
          <div>
            <div className="lr-page-title">检验结果解读</div>
            <div className="lr-page-sub">
              共 {MOCK_RESULTS.length} 项 · 异常 {abnormalCount} 项 · 危急值 {criticalCount} 项
            </div>
          </div>
        </div>
        <div className="lr-header-badges">
          {criticalCount > 0 && (
            <span className="lr-badge-critical">🚨 {criticalCount} 危急值</span>
          )}
          {upgradeCount > 0 && (
            <span className="lr-badge-upgrade">🔺 诊断需升级</span>
          )}
          {reviewedAll && <span className="lr-badge-reviewed">✓ 已阅</span>}
        </div>
      </div>

      {/* ════════════════ 筛选 Tab ════════════════ */}
      <div className="lr-filter-bar">
        {([
          { id: 'all',      label: `全部（${MOCK_RESULTS.length}）` },
          { id: 'abnormal', label: `异常（${abnormalCount}）` },
          { id: 'critical', label: `危急值（${criticalCount}）` },
        ] as { id: FilterTab; label: string }[]).map(tab => (
          <button
            key={tab.id}
            className={`lr-filter-tab ${filterTab === tab.id ? 'active' : ''}`}
            onClick={() => setFilterTab(tab.id)}
          >{tab.label}</button>
        ))}
      </div>

      {/* ════════════════ 结果列表 + 后续 section ════════════════ */}
      <div className="lr-body">

        {/* ════════════════ ① 危急值专项提醒 ════════════════ */}
        {criticalResults.length > 0 && (
          <div className="lr-critical-section">
            <div className="lr-critical-header">
              <span className="lr-critical-flash">🚨</span>
              <span className="lr-critical-title">危急值 — 需立即处理</span>
              <span className="lr-critical-sub">以下结果已超出危急值范围，请立即关注并采取处置措施</span>
            </div>
            {criticalResults.map(r => {
              const sCfg = STATUS_CFG[r.status]
              return (
                <div key={r.test_id} className="lr-critical-card">
                  <div className="lr-crit-top">
                    <div className="lr-crit-left">
                      <span className="lr-crit-badge" style={{ color: sCfg.color }}>{sCfg.label}</span>
                      <span className="lr-crit-name">{r.name}</span>
                    </div>
                    <div className="lr-crit-value" style={{ color: sCfg.color }}>
                      {r.value}<span className="lr-crit-unit"> {r.unit}</span>
                    </div>
                    <button
                      className="lr-crit-btn-treat"
                      onClick={() => setCurrentStep('personalized-treatment')}
                    >查看治疗方案</button>
                  </div>
                  <div className="lr-crit-content">
                    {r.delta && <div className="lr-crit-delta">{r.delta}</div>}
                    <div className="lr-crit-note">{commentMap[r.test_id] ?? r.clinical_note}</div>
                    {r.immediate_action && (
                      <div className="lr-crit-action">
                        <span className="lr-crit-action-icon">→</span>
                        {r.immediate_action}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ════════════════ 诊断影响预警 ════════════════ */}
        {diagnosisAlerts.map((alert, i) => {
          const cfg = ALERT_LEVEL_CFG[alert.level]
          return (
            <div key={i} className="lr-diagnosis-alert" style={{ background: cfg.bg, borderColor: cfg.border }}>
              <div className="lr-da-title" style={{ color: cfg.color }}>{alert.title}</div>
              <div className="lr-da-detail">{alert.detail}</div>
              <div className="lr-da-action">
                {alert.level === 'critical' ? (
                  <button
                    className="lr-da-btn"
                    style={{ background: cfg.color }}
                    onClick={() => setCurrentStep('diagnosis')}
                  >前往辅助诊断更新诊断 →</button>
                ) : (
                  <span className="lr-da-action-text">→ {alert.action}</span>
                )}
              </div>
            </div>
          )
        })}

        {CATEGORY_ORDER.map(cat => {
          const items = byCategory[cat]
          if (!items || items.length === 0) return null
          return (
            <div key={cat} className="lr-section">
              <div className="lr-sec-title">{cat}</div>
              <div className="lr-result-list">
                {items.map(result => {
                  const sCfg   = STATUS_CFG[result.status]
                  const iCfg   = IMPACT_CFG[result.diagnosis_impact]
                  const isOpen = expandedResult === result.test_id
                  const barPct = calcBarPct(result)

                  return (
                    <div
                      key={result.test_id}
                      className={`lr-result-card ${result.status} ${isOpen ? 'open' : ''}`}
                    >
                      <div
                        className="lr-result-main"
                        onClick={() => setExpandedResult(isOpen ? null : result.test_id)}
                      >
                        <div className="lr-status-stripe" style={{ background: sCfg.barColor }} />
                        <div className="lr-result-core">
                          <div className="lr-result-name-row">
                            <span className="lr-result-name">{result.name}</span>
                            <span className="lr-status-badge" style={{ color: sCfg.color, background: sCfg.bg, borderColor: sCfg.border }}>
                              {sCfg.label}
                            </span>
                            <span className="lr-impact-badge" style={{ color: iCfg.color, background: iCfg.bg }}>
                              {iCfg.icon} {iCfg.label}
                            </span>
                          </div>
                          <div className="lr-value-row">
                            <span className="lr-value" style={{ color: result.status === 'normal' ? '#1a3a50' : sCfg.color }}>
                              {result.value}
                              {result.unit && <span className="lr-unit"> {result.unit}</span>}
                            </span>
                            <span className="lr-ref">参考：{result.ref_range}</span>
                            {result.delta && <span className="lr-delta">{result.delta}</span>}
                          </div>
                          {barPct !== null && (
                            <div className="lr-bar-wrap">
                              <div className="lr-bar-track">
                                <div className="lr-bar-normal-zone" />
                                <div
                                  className="lr-bar-pointer"
                                  style={{ left: `${Math.min(barPct, 100)}%`, background: sCfg.barColor }}
                                />
                              </div>
                              <div className="lr-bar-labels">
                                <span>{result.ref_min ?? ''}</span>
                                <span className="lr-bar-label-center">正常范围</span>
                                <span>{result.ref_max ?? ''}</span>
                              </div>
                            </div>
                          )}
                          <div className="lr-collected-at">采集：{result.collected_at}</div>
                        </div>
                        <span className={`lr-expand-chevron ${isOpen ? 'open' : ''}`}>›</span>
                      </div>

                      {isOpen && (
                        <div className="lr-result-detail">
                          <div className="lr-detail-block">
                            <div className="lr-detail-label">临床解读</div>
                            <p className="lr-detail-text">{commentMap[result.test_id] ?? result.clinical_note}</p>
                          </div>
                          <div className="lr-detail-block">
                            <div className="lr-detail-label">
                              <span className="lr-impact-inline" style={{ color: iCfg.color, background: iCfg.bg }}>
                                {iCfg.icon} {iCfg.label}
                              </span>
                              对诊断的影响
                            </div>
                            <p className="lr-detail-text">{result.impact_detail}</p>
                          </div>
                          {result.treatment_note && (
                            <div className="lr-detail-block">
                              <div className="lr-detail-label">治疗方案影响</div>
                              <p className="lr-detail-text lr-treatment-note">{result.treatment_note}</p>
                            </div>
                          )}
                          {result.immediate_action && (
                            <div className="lr-detail-block">
                              <div className="lr-detail-label" style={{ color: '#c0392b' }}>🚨 立即处理</div>
                              <p className="lr-detail-text lr-immediate-note">{result.immediate_action}</p>
                            </div>
                          )}
                          <div className="lr-detail-tags">
                            {result.related_tags.map(t => (
                              <span key={t} className="lr-tag">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ════════════════ ② 行动建议 ════════════════ */}
        <div className="lr-section lr-action-rec-section">
          <div className="lr-sec-title">
            基于结果的行动建议
            <span className="lr-rec-badge">{MOCK_ACTION_RECS.length} 项</span>
            {urgentActCount > 0 && (
              <span className="lr-rec-urgent-badge">{urgentActCount} 项紧急</span>
            )}
          </div>

          {ACTION_TYPES.map(type => {
            const items = MOCK_ACTION_RECS.filter(a => a.type === type)
            if (items.length === 0) return null
            const cfg = ACTION_CFG[type]
            return (
              <div key={type} className="lr-action-group">
                <div className="lr-action-group-title">
                  <span className="lr-action-type-badge" style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                <div className="lr-action-items">
                  {items.map((item, i) => {
                    const pCfg = PRIORITY_CFG[item.priority]
                    return (
                      <div key={i} className="lr-action-item">
                        <span className="lr-action-priority" style={{ color: pCfg.color }}>
                          [{pCfg.label}]
                        </span>
                        <span className="lr-action-content">{item.content}</span>
                        {item.target_step && (
                          <button
                            className="lr-action-link"
                            onClick={() => setCurrentStep(item.target_step!)}
                          >{item.target_label} →</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* ════════════════ ③ 页签联动 ════════════════ */}
        <div className="lr-section lr-linkage-section">
          <div className="lr-sec-title">结果输入其他功能模块</div>
          <div className="lr-linkage-grid">
            {MOCK_LINKAGE.map(link => (
              <div
                key={link.step}
                className="lr-linkage-card"
                style={{ borderColor: link.border, background: link.bg }}
                onClick={() => setCurrentStep(link.step)}
              >
                <div className="lr-link-header">
                  <span className="lr-link-icon">{link.icon}</span>
                  <span className="lr-link-label" style={{ color: link.color }}>{link.label}</span>
                  <span className="lr-link-count" style={{ color: link.color }}>
                    {link.count} 项相关
                  </span>
                </div>
                <div className="lr-link-desc">{link.desc}</div>
                <div className="lr-link-goto" style={{ color: link.color }}>点击跳转 →</div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════ ④ 综合解读摘要 ════════════════ */}
        <div className="lr-section lr-summary-section">
          <div className="lr-summary-header">
            <div className="lr-sec-title" style={{ margin: 0 }}>综合解读摘要</div>
            {!summaryGenerated ? (
              <button
                className="lr-btn-generate"
                onClick={() => { setSummaryGenerated(true); setSummaryOpen(true) }}
              >一键生成摘要</button>
            ) : (
              <button
                className="lr-btn-toggle"
                onClick={() => setSummaryOpen(v => !v)}
              >{summaryOpen ? '收起' : '展开'}</button>
            )}
          </div>
          {summaryGenerated && summaryOpen && (
            <>
              <pre className="lr-summary-text">{summary}</pre>
              <div className="lr-summary-actions">
                <button className="lr-btn-copy" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '复制报告'}
                </button>
                <button className="lr-btn-writeback" onClick={openWritebackModal}>
                  回写 HIS
                </button>
              </div>
            </>
          )}
        </div>

        {/* ════════════════ ⑤ 输出操作 ════════════════ */}
        <div className="lr-action-section">
          {reviewedAll ? (
            <div className="lr-reviewed-bar">
              <span>✓ 已确认阅读全部检验结果</span>
              <button className="lr-btn-ghost-sm" onClick={() => setReviewedAll(false)}>撤销</button>
            </div>
          ) : (
            <div className="lr-action-row">
              <button
                className="lr-btn-confirm"
                onClick={() => { setReviewedAll(true); showToast('已确认阅读全部检验结果', 'success') }}
              >确认结果已阅</button>
              {upgradeCount > 0 && (
                <button
                  className="lr-btn-goto-dx"
                  onClick={() => setCurrentStep('diagnosis')}
                >前往更新诊断 →</button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
