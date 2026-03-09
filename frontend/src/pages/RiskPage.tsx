import { useState, useMemo } from 'react'
import { useAppStore } from '../store'
import './common.css'
import './RiskPage.css'

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

type RiskLevel       = 'critical' | 'high' | 'moderate' | 'low'
type AlertLevel      = 'critical' | 'warning' | 'caution' | 'info'
type AlertCategory   = '药物安全' | '临床预警' | '合规审核' | '诊断一致性'
type SuggestionType  = 'exam' | 'diagnosis' | 'treatment' | 'consult' | 'monitor'

// ── 诊断合理性审核专用类型 ──────────────────────────────

type AuditStatus     = 'pass' | 'pending' | 'conflict' | 'missing'
type EvidenceWeight  = 'strong' | 'moderate' | 'weak'
type MissingImportance = 'critical' | 'important' | 'optional'
type DiffUrgency     = 'exclude_urgently' | 'reconsider' | 'monitor'
type AuditTabId      = 'support' | 'missing' | 'conflict' | 'differential'

interface SupportingEvidence {
  id: string
  text: string
  weight: EvidenceWeight
  source: string
}

interface MissingEvidence {
  id: string
  text: string
  importance: MissingImportance
  reason: string
  recommended_tests: string[]
}

interface DiagnosisConflict {
  id: string
  level: AlertLevel
  title: string
  detail: string
}

interface DifferentialReminder {
  disease: string
  urgency: DiffUrgency
  reason: string
  suggest: string
}

interface AuditCorrectionRec {
  type: 'exam' | 'diagnosis' | 'exclude'
  content: string
}

interface DiagnosisAuditResult {
  diagnosis_name: string
  audit_status: AuditStatus
  audit_summary: string
  supporting_evidence: SupportingEvidence[]
  missing_evidence: MissingEvidence[]
  conflict_alerts: DiagnosisConflict[]
  differential_reminders: DifferentialReminder[]
  correction_recommendations: AuditCorrectionRec[]
}

// ── 风险评分类型 ──────────────────────────────────────

interface ScoreModel {
  name: string
  score: number | string
  max?: number
  level: RiskLevel
  description: string
  factors: { name: string; value: string; contribution: 'high' | 'medium' | 'low' }[]
}

interface RiskAlert {
  id: string
  category: AlertCategory
  level: AlertLevel
  title: string
  detail: string
  related: string[]
  action: string
}

interface Suggestion {
  type: SuggestionType
  title: string
  content: string
  priority: 'urgent' | 'recommended' | 'optional'
}

// ══════════════════════════════════════════════════════
// Mock 数据
// ══════════════════════════════════════════════════════

const MOCK_AUDIT: DiagnosisAuditResult = {
  diagnosis_name: '不稳定型心绞痛',
  audit_status: 'pending',
  audit_summary: '当前诊断存在关键缺失证据（hs-cTn 尚未返回），暂无法完全排除 NSTEMI。支持证据充分，但需在高敏肌钙蛋白连续检测结果返回后方可最终确认诊断。',
  supporting_evidence: [
    {
      id: 'SE001',
      text: '典型缺血性胸痛：劳力后及静息发作，持续 15–30 分钟，放射至左肩部',
      weight: 'strong',
      source: '主诉 + 现病史',
    },
    {
      id: 'SE002',
      text: '心电图 ST 段压低 ≥ 1mm（II、III、aVF 导联），符合心内膜下缺血表现',
      weight: 'strong',
      source: '12 导联 ECG',
    },
    {
      id: 'SE003',
      text: '多重心血管危险因素：高血压史 10 年 + 2 型糖尿病 + 年龄 65 岁',
      weight: 'moderate',
      source: '既往史 + 辅助输入',
    },
    {
      id: 'SE004',
      text: '硝酸甘油含服有效，5 分钟内胸痛缓解',
      weight: 'moderate',
      source: '现病史',
    },
    {
      id: 'SE005',
      text: 'GRACE 评分 142 分（高危层），TIMI 评分 4 分（中高危），与 ACS 诊断方向一致',
      weight: 'moderate',
      source: '风险评分模型',
    },
  ],
  missing_evidence: [
    {
      id: 'ME001',
      text: 'hs-cTn 0h/1h 连续检测结果（核心诊断指标）',
      importance: 'critical',
      reason: '高敏肌钙蛋白是区分 UA 与 NSTEMI 的唯一决定性指标。结果未返回前，NSTEMI 无法排除，诊断确认受阻。',
      recommended_tests: ['高敏肌钙蛋白 I / T（L002）'],
    },
    {
      id: 'ME002',
      text: 'D-二聚体（肺栓塞排除）',
      importance: 'important',
      reason: '患者存在呼吸困难症状，肺栓塞可引起 ST 改变，需快速排除。',
      recommended_tests: ['D-二聚体（新增检验）'],
    },
    {
      id: 'ME003',
      text: '冠脉影像学评估（CCTA 或造影）',
      importance: 'important',
      reason: '明确冠脉狭窄程度及斑块性质，为确诊与治疗决策（介入 vs 药物）提供解剖依据。',
      recommended_tests: ['冠状动脉 CTA（I002）'],
    },
    {
      id: 'ME004',
      text: 'BNP / NT-proBNP（心功能评估）',
      importance: 'optional',
      reason: '排除心力衰竭合并缺血，辅助评估左室功能状态。',
      recommended_tests: ['BNP / NT-proBNP（L003）'],
    },
  ],
  conflict_alerts: [
    {
      id: 'CA001',
      level: 'warning',
      title: '无法排除 NSTEMI — hs-cTn 结果待返回',
      detail: '不稳定型心绞痛（UA）与非 ST 段抬高型心肌梗死（NSTEMI）临床表现高度相似，二者仅凭症状与 ECG 无法鉴别。ESC 0h/1h 快速诊断方案要求连续 hs-cTn 检测，任一时间点升高即支持 NSTEMI。当前结果未返回，现诊断处于临时状态。',
    },
    {
      id: 'CA002',
      level: 'caution',
      title: '心电图变化符合缺血模式，但未达 STEMI 标准',
      detail: 'ST 压低提示心内膜下缺血，排除 STEMI（ST 抬高型），支持 UA/NSTEMI 鉴别范围。但 ST 压低亦可见于肺栓塞、低钾血症等情况，需结合其他检查综合判断。',
    },
  ],
  differential_reminders: [
    {
      disease: '非 ST 段抬高型心肌梗死（NSTEMI）',
      urgency: 'exclude_urgently',
      reason: '症状、ECG 与 UA 高度重叠，唯一区别在于心肌损伤标志物是否升高。若 hs-cTn 升高，诊断应立即升级为 NSTEMI，抗栓策略随之升级。',
      suggest: '等待 hs-cTn 0h/1h 结果（预计 < 2 小时）',
    },
    {
      disease: '主动脉夹层（Stanford A/B 型）',
      urgency: 'exclude_urgently',
      reason: '若患者有"撕裂样"背痛或血压双侧不对称，需立即排除。主动脉夹层可导致冠脉受累引发 ECG 改变，误诊风险极高。',
      suggest: '明确有无撕裂样背痛；若可疑，急查主动脉 CT 血管造影',
    },
    {
      disease: '肺动脉栓塞（PE）',
      urgency: 'reconsider',
      reason: '患者合并呼吸困难，肺栓塞可引起胸痛、ECG ST 改变（右心负荷增加）。D-二聚体未查，Wells 评分需综合评估。',
      suggest: '查 D-二聚体；若阳性，行 CT 肺动脉造影（CTPA）',
    },
    {
      disease: '变异型心绞痛（Prinzmetal）',
      urgency: 'monitor',
      reason: '静息发作、夜间多见、ST 一过性抬高后恢复，可能被误诊为 UA。动态心电图可捕捉发作时 ECG 变化。',
      suggest: '安排 24h 动态心电图（Holter）',
    },
  ],
  correction_recommendations: [
    { type: 'exam',      content: '立即催促 hs-cTn 0h/1h 及肾功能结果（影响 GRACE 精度及 ACEI 安全性）' },
    { type: 'exam',      content: '补查 D-二聚体，快速排除肺栓塞' },
    { type: 'diagnosis', content: 'hs-cTn 结果返回后需立即复核诊断：若升高则升级为 NSTEMI' },
    { type: 'diagnosis', content: '明确询问患者有无"撕裂样"背痛，排除主动脉夹层' },
    { type: 'exclude',   content: '优先排除 NSTEMI（高度相似，唯一区别在心肌标志物）' },
    { type: 'exclude',   content: '条件允许时尽快完成心脏超声，排除瓣膜源性胸痛及严重左室功能障碍' },
  ],
}

const MOCK_SCORE_MODELS: ScoreModel[] = [
  {
    name: 'GRACE 评分（急性冠脉综合征）',
    score: 142,
    max: 263,
    level: 'high',
    description: '院内死亡风险 3–8%（高危），建议早期侵入性策略（24h 内行冠脉造影）',
    factors: [
      { name: '年龄', value: '65 岁', contribution: 'high' },
      { name: '心率', value: '88 次/分', contribution: 'medium' },
      { name: '收缩压', value: '158 mmHg', contribution: 'high' },
      { name: '肌酐', value: '待查', contribution: 'medium' },
      { name: '心电图改变', value: 'ST 段压低', contribution: 'high' },
      { name: 'hs-cTn', value: '待查', contribution: 'high' },
    ],
  },
  {
    name: 'TIMI 评分（不稳定型心绞痛）',
    score: 4,
    max: 7,
    level: 'moderate',
    description: '14天主要心血管事件风险约 19.9%（中高危），推荐积极药物治疗并早期评估',
    factors: [
      { name: '年龄 ≥ 65 岁', value: '是',          contribution: 'high' },
      { name: '冠心病危险因素 ≥ 3 个', value: '是',  contribution: 'medium' },
      { name: '既往冠脉狭窄 ≥ 50%', value: '未知',   contribution: 'low' },
      { name: '心电图 ST 改变', value: '是',          contribution: 'high' },
      { name: '24h 内心绞痛发作 ≥ 2 次', value: '是', contribution: 'high' },
      { name: '阿司匹林使用史', value: '否',          contribution: 'medium' },
      { name: '升高的心肌标志物', value: '待查',       contribution: 'high' },
    ],
  },
  {
    name: 'PRECISE-DAPT（双联抗血小板出血风险）',
    score: 27,
    max: 100,
    level: 'high',
    description: '评分 ≥ 25 分为出血高危，建议缩短 DAPT 疗程至 3–6 个月',
    factors: [
      { name: '年龄', value: '65 岁',   contribution: 'high' },
      { name: '血肌酐清除率', value: '待查', contribution: 'medium' },
      { name: '血红蛋白', value: '待查', contribution: 'medium' },
      { name: '白细胞计数', value: '待查', contribution: 'low' },
      { name: '既往自发出血史', value: '无', contribution: 'low' },
    ],
  },
]

const MOCK_ALERTS: RiskAlert[] = [
  {
    id: 'A001',
    category: '药物安全',
    level: 'warning',
    title: '青霉素过敏史 — 头孢菌素类交叉过敏风险',
    detail: '患者有明确青霉素过敏史（过敏反应）。头孢菌素与青霉素存在约 2% 交叉过敏风险。当前处方中未见头孢类，但如需抗感染治疗，须避免使用此类药物。',
    related: ['青霉素', '头孢菌素'],
    action: '如需抗感染，优先选用大环内酯类或喹诺酮类',
  },
  {
    id: 'A002',
    category: '药物安全',
    level: 'caution',
    title: '氯吡格雷 + 奥美拉唑 — CYP2C19 代谢相互作用',
    detail: '奥美拉唑是 CYP2C19 强抑制剂，可使氯吡格雷活性代谢产物浓度下降 40–50%，显著削弱抗血小板效果，增加心血管事件风险（FDA 黑框警告）。',
    related: ['氯吡格雷', '奥美拉唑'],
    action: '将奥美拉唑替换为泮托拉唑（CYP2C19 影响较小）',
  },
  {
    id: 'A003',
    category: '药物安全',
    level: 'caution',
    title: 'ACEI（培哚普利）+ 高钾风险',
    detail: 'ACEI 可抑制醛固酮分泌导致钾潴留，合并糖尿病患者风险更高。启药后 1–2 周必须复查血钾，>5.5 mmol/L 须立即调整方案。',
    related: ['培哚普利', '血钾'],
    action: '启药后 2 周内复查电解质 + 肌酐',
  },
  {
    id: 'A004',
    category: '临床预警',
    level: 'critical',
    title: 'PRECISE-DAPT ≥ 25 — 双联抗血小板出血高危',
    detail: '患者 PRECISE-DAPT 评分 27 分（高危阈值 25 分），当前方案为阿司匹林 + 氯吡格雷双联抗血小板治疗，出血事件风险显著升高，需权衡缺血与出血风险比。',
    related: ['阿司匹林', '氯吡格雷', 'PRECISE-DAPT'],
    action: '评估是否缩短 DAPT 至 3–6 个月；加用 PPI 保护（注意 CYP2C19 相互作用）',
  },
  {
    id: 'A005',
    category: '临床预警',
    level: 'warning',
    title: 'β阻滞剂（比索洛尔）掩盖低血糖症状',
    detail: 'β阻滞剂可掩盖心悸、手抖等低血糖警示症状，血糖控制不佳患者低血糖感知能力下降，有延迟处置风险。',
    related: ['比索洛尔', '低血糖', '血糖控制不佳'],
    action: '增加血糖自我监测频率至 ≥ 2 次/天；告知患者注意出汗异常',
  },
  {
    id: 'A006',
    category: '临床预警',
    level: 'caution',
    title: '他汀类（阿托伐他汀）轻度升高血糖风险',
    detail: '大剂量他汀使新发糖尿病风险增加约 10–12%，现血糖控制不佳患者使用 20mg 维持剂量是合理权衡，但仍需监测 HbA1c 变化趋势。',
    related: ['阿托伐他汀', 'HbA1c', '血糖控制不佳'],
    action: '3 个月后复查 HbA1c；如 HbA1c 持续升高，与内分泌科联合评估',
  },
  {
    id: 'A007',
    category: '合规审核',
    level: 'info',
    title: '关键检验项目未完成 — 方案尚不完整',
    detail: '高敏肌钙蛋白（hs-cTn）及肾功能检验尚未完成，这两项结果直接影响 GRACE 评分精度及 ACEI 用药安全性。',
    related: ['hs-cTn', '肾功能', 'GRACE评分'],
    action: '优先催促 hs-cTn 及肾功能结果，预计 1–2 小时内返回',
  },
  {
    id: 'A008',
    category: '诊断一致性',
    level: 'info',
    title: '用药方案与当前诊断基本一致',
    detail: '当前用药方案（抗血小板 + 硝酸酯 + β阻滞剂 + 他汀）符合 ACC/AHA 对 UA/NSTEMI 的推荐，无明显用药诊断不符项。',
    related: ['不稳定型心绞痛', '标准抗心绞痛方案'],
    action: '无需调整',
  },
]

const MOCK_SUGGESTIONS: Suggestion[] = [
  { type: 'exam',      title: '补充检验：hs-cTn 0h/1h 方案 + 肾功能 + 血钾',                     content: 'hs-cTn 连续检测是 ACS 快速排除/确认的核心，同时肾功能及血钾结果是 ACEI 安全使用及 GRACE 评分完善的前提。', priority: 'urgent' },
  { type: 'exam',      title: '补充检查：心脏超声（LVEF 评估）',                                   content: 'LVEF < 40% 时治疗策略有所不同，超声结果对分层决策至关重要。', priority: 'recommended' },
  { type: 'diagnosis', title: '候选诊断方向：关注 NSTEMI 可能',                                    content: '若 hs-cTn 升高，诊断应升级为 NSTEMI，治疗策略及随访频率需相应调整。', priority: 'urgent' },
  { type: 'treatment', title: '调整建议：将奥美拉唑替换为泮托拉唑',                                 content: '避免 CYP2C19 介导的氯吡格雷疗效削减（FDA 建议）。', priority: 'recommended' },
  { type: 'treatment', title: '考虑缩短 DAPT 疗程至 3–6 个月',                                    content: 'PRECISE-DAPT 27 分（高危），参考个性化治疗"单抗血小板备选方案"。', priority: 'recommended' },
  { type: 'consult',   title: '建议内分泌科会诊：血糖控制优化',                                    content: '患者血糖控制不佳，需制定更积极的降糖方案。', priority: 'recommended' },
  { type: 'monitor',   title: '重点监测：血钾（启用 ACEI 后 2 周）',                               content: '培哚普利启用后存在高钾风险，>5.5 mmol/L 须立即调整。', priority: 'urgent' },
  { type: 'monitor',   title: '重点监测：血糖（≥ 2 次/天）',                                       content: 'β阻滞剂掩盖低血糖症状，需强化自我监测。', priority: 'recommended' },
]

// ══════════════════════════════════════════════════════
// 工具配置
// ══════════════════════════════════════════════════════

const AUDIT_STATUS_CFG: Record<AuditStatus, { label: string; color: string; bg: string; border: string; icon: string; desc: string }> = {
  pass:     { label: '审核通过',     color: '#1e8449', bg: '#eafaf1', border: '#a9dfbf', icon: '✓', desc: '诊断有充分证据支持，无冲突' },
  pending:  { label: '证据待补充',   color: '#d68910', bg: '#fef9ec', border: '#f9d78e', icon: '⏳', desc: '关键检验结果尚未返回，诊断临时确认' },
  conflict: { label: '存在冲突',     color: '#c0392b', bg: '#fdedec', border: '#f1948a', icon: '⚡', desc: '诊断与现有证据存在不符项' },
  missing:  { label: '缺失关键证据', color: '#8e44ad', bg: '#f5eef8', border: '#d2b4de', icon: '!',  desc: '诊断所需关键依据尚未完成' },
}

const EVIDENCE_WEIGHT_CFG: Record<EvidenceWeight, { label: string; color: string; bg: string }> = {
  strong:   { label: '强支持', color: '#1e8449', bg: '#eafaf1' },
  moderate: { label: '中等',   color: '#d68910', bg: '#fef9ec' },
  weak:     { label: '弱支持', color: '#5d8a9e', bg: '#eaf4fd' },
}

const MISSING_IMPORTANCE_CFG: Record<MissingImportance, { label: string; color: string; bg: string; border: string }> = {
  critical:  { label: '必需',  color: '#c0392b', bg: '#fdedec', border: '#f1948a' },
  important: { label: '重要',  color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  optional:  { label: '可选',  color: '#5d8a9e', bg: '#eaf4fd', border: '#aed6f1' },
}

const DIFF_URGENCY_CFG: Record<DiffUrgency, { label: string; color: string; bg: string; border: string; icon: string }> = {
  exclude_urgently: { label: '需优先排除', color: '#922b21', bg: '#fdedec', border: '#e74c3c', icon: '🚨' },
  reconsider:       { label: '建议重新考虑', color: '#d68910', bg: '#fef9ec', border: '#f9d78e', icon: '⚠' },
  monitor:          { label: '持续关注',   color: '#2980b9', bg: '#eaf4fd', border: '#aed6f1', icon: 'ℹ' },
}

const AUDIT_CORR_CFG: Record<AuditCorrectionRec['type'], { label: string; color: string; bg: string; icon: string }> = {
  exam:      { label: '补充检查',   color: '#2980b9', bg: '#eaf4fd', icon: '🔬' },
  diagnosis: { label: '诊断方向',   color: '#8e44ad', bg: '#f5eef8', icon: '⚕' },
  exclude:   { label: '优先排除',   color: '#c0392b', bg: '#fdedec', icon: '🚨' },
}

const RISK_LEVEL_CFG: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: '极高危', color: '#922b21', bg: '#fdedec', border: '#e74c3c' },
  high:     { label: '高危',   color: '#c0392b', bg: '#fdedec', border: '#f1948a' },
  moderate: { label: '中危',   color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  low:      { label: '低危',   color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf' },
}

const ALERT_LEVEL_CFG: Record<AlertLevel, { icon: string; color: string; bg: string; border: string; label: string }> = {
  critical: { icon: '🚨', color: '#922b21', bg: '#fdedec', border: '#e74c3c', label: '严重' },
  warning:  { icon: '⚠',  color: '#c0392b', bg: '#fef2f0', border: '#f1948a', label: '警告' },
  caution:  { icon: '⚡',  color: '#d68910', bg: '#fef9ec', border: '#f9d78e', label: '注意' },
  info:     { icon: 'ℹ',  color: '#2980b9', bg: '#eaf4fd', border: '#aed6f1', label: '提示' },
}

const CATEGORY_ICONS: Record<AlertCategory, string> = {
  '药物安全':   '💊',
  '临床预警':   '⚑',
  '合规审核':   '📋',
  '诊断一致性': '⚕',
}

const SUGGESTION_CFG: Record<SuggestionType, { icon: string; label: string; color: string; bg: string }> = {
  exam:      { icon: '🔬', label: '补充检查',  color: '#2980b9', bg: '#eaf4fd' },
  diagnosis: { icon: '⚕',  label: '诊断方向',  color: '#8e44ad', bg: '#f5eef8' },
  treatment: { icon: '💊', label: '治疗调整',  color: '#d68910', bg: '#fef9ec' },
  consult:   { icon: '👨‍⚕️', label: '会诊/转诊', color: '#16a085', bg: '#e8f8f5' },
  monitor:   { icon: '📈', label: '重点监测',  color: '#27ae60', bg: '#eafaf1' },
}

const PRIORITY_CFG: Record<Suggestion['priority'], { label: string; color: string }> = {
  urgent:      { label: '紧急', color: '#c0392b' },
  recommended: { label: '建议', color: '#d68910' },
  optional:    { label: '可选', color: '#5d8a9e' },
}

const ALERT_CATEGORIES: AlertCategory[] = ['药物安全', '临床预警', '合规审核', '诊断一致性']

const AUDIT_TABS: { id: AuditTabId; label: string }[] = [
  { id: 'support',      label: '支持证据' },
  { id: 'missing',      label: '缺失证据' },
  { id: 'conflict',     label: '冲突预警' },
  { id: 'differential', label: '鉴别提示' },
]

// ══════════════════════════════════════════════════════
// 摘要生成
// ══════════════════════════════════════════════════════

function buildSummary(
  auditAcknowledged: boolean,
  continueCurrentDx: boolean,
  diagnosis: string,
  patientName: string,
  visitId: string,
): string {
  const a = MOCK_AUDIT
  const sCfg = AUDIT_STATUS_CFG[a.audit_status]
  const criticalMissing = a.missing_evidence.filter(m => m.importance === 'critical')
  const urgentDiff = a.differential_reminders.filter(d => d.urgency === 'exclude_urgently')

  const supportLines = a.supporting_evidence.map(e =>
    `[${EVIDENCE_WEIGHT_CFG[e.weight].label}] ${e.text}（${e.source}）`
  ).join('\n')

  const missingLines = a.missing_evidence.map(m =>
    `[${MISSING_IMPORTANCE_CFG[m.importance].label}] ${m.text}\n  原因：${m.reason}`
  ).join('\n')

  const conflictLines = a.conflict_alerts.map(c =>
    `[${ALERT_LEVEL_CFG[c.level].label}] ${c.title}`
  ).join('\n')

  const diffLines = a.differential_reminders.map(d =>
    `[${DIFF_URGENCY_CFG[d.urgency].label}] ${d.disease}\n  ${d.reason}\n  建议：${d.suggest}`
  ).join('\n')

  const corrLines = a.correction_recommendations.map((r, i) =>
    `${i + 1}. [${AUDIT_CORR_CFG[r.type].label}] ${r.content}`
  ).join('\n')

  const riskLines = MOCK_SCORE_MODELS.map(m =>
    `· ${m.name}：${m.score}${m.max ? '/' + m.max : ''} 分（${RISK_LEVEL_CFG[m.level].label}）`
  ).join('\n')

  return [
    '【风险审核报告】',
    `患者：${patientName || '—'}   就诊号：${visitId || '—'}`,
    `当前诊断：${diagnosis || a.diagnosis_name}`,
    `审核状态：${sCfg.icon} ${sCfg.label}`,
    `医生处置：${auditAcknowledged ? '已知晓' : '未确认'}${continueCurrentDx ? '·继续采用当前诊断' : ''}`,
    '',
    '【诊断合理性审核】',
    a.audit_summary,
    '',
    `【支持证据（${a.supporting_evidence.length} 项）】`,
    supportLines,
    '',
    `【缺失证据（${a.missing_evidence.length} 项，关键 ${criticalMissing.length} 项）】`,
    missingLines,
    '',
    `【冲突预警（${a.conflict_alerts.length} 项）】`,
    conflictLines,
    '',
    `【鉴别诊断提示（${a.differential_reminders.length} 项，需紧急排除 ${urgentDiff.length} 项）】`,
    diffLines,
    '',
    `【修正建议（${a.correction_recommendations.length} 项）】`,
    corrLines,
    '',
    '【风险评分汇总】',
    riskLines,
    '',
    `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
  ].join('\n')
}

// ══════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════

export default function RiskPage() {
  const {
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal, setCurrentStep,
  } = useAppStore()

  // ── 诊断审核状态 ──
  const [auditTab,            setAuditTab]            = useState<AuditTabId>('support')
  const [expandedMissing,     setExpandedMissing]     = useState<string | null>(null)
  const [expandedDiff,        setExpandedDiff]        = useState<string | null>(null)
  const [auditAcknowledged,   setAuditAcknowledged]   = useState(false)
  const [continueCurrentDx,   setContinueCurrentDx]   = useState(false)

  // ── 风险评分 & 预警状态 ──
  const [expandedModel,       setExpandedModel]       = useState<string | null>(null)
  const [expandedAlert,       setExpandedAlert]       = useState<string | null>(null)

  // ── 输出 ──
  const [confirmed,           setConfirmed]           = useState(false)
  const [saved,               setSaved]               = useState(false)
  const [summaryGenerated,    setSummaryGenerated]    = useState(false)
  const [summaryOpen,         setSummaryOpen]         = useState(false)
  const [copied,              setCopied]              = useState(false)

  const alertsByCategory = useMemo(() =>
    ALERT_CATEGORIES.reduce<Record<AlertCategory, RiskAlert[]>>((acc, cat) => {
      acc[cat] = MOCK_ALERTS.filter(a => a.category === cat)
      return acc
    }, {} as Record<AlertCategory, RiskAlert[]>),
  [])

  const criticalCount  = MOCK_ALERTS.filter(a => a.level === 'critical').length
  const warningCount   = MOCK_ALERTS.filter(a => a.level === 'warning').length
  const urgentSugCount = MOCK_SUGGESTIONS.filter(s => s.priority === 'urgent').length
  const aCfg           = AUDIT_STATUS_CFG[MOCK_AUDIT.audit_status]

  const summary = useMemo(() => buildSummary(
    auditAcknowledged,
    continueCurrentDx,
    selectedDiagnosis,
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
  ), [auditAcknowledged, continueCurrentDx, selectedDiagnosis, patientContext])

  const handleAcknowledge = () => {
    setAuditAcknowledged(true)
    showToast('已标记知晓本次诊断审核结果', 'success')
  }

  const handleContinueDx = () => {
    setContinueCurrentDx(true)
    setAuditAcknowledged(true)
    showToast('已确认：继续采用当前诊断', 'success')
  }

  const handleGoToDiagnosis = () => {
    setCurrentStep('diagnosis')
    showToast('已跳转至辅助诊断页签', 'info')
  }

  const handleSave = () => {
    setSaved(true)
    setSummaryGenerated(true)
    setSummaryOpen(true)
    showToast('审核结果已保存', 'success')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      showToast('审核报告已复制到剪贴板', 'info')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  return (
    <div className="page rk-page">

      {/* ── 页头 ── */}
      <div className="rk-header">
        <div className="rk-header-left">
          <span className="rk-page-icon">⚑</span>
          <div>
            <div className="rk-page-title">风险审核</div>
            <div className="rk-page-sub">
              诊断合理性 · 药物安全 · 临床风险 · {urgentSugCount} 项紧急建议
            </div>
          </div>
        </div>
        <div className="rk-header-badges">
          <span className="rk-badge-audit" style={{ color: aCfg.color, background: aCfg.bg, borderColor: aCfg.border }}>
            {aCfg.icon} {aCfg.label}
          </span>
          {criticalCount > 0 && <span className="rk-badge-critical">{criticalCount} 严重</span>}
          {warningCount  > 0 && <span className="rk-badge-warning">{warningCount} 警告</span>}
          {confirmed && <span className="rk-badge-confirmed">✓ 已确认</span>}
        </div>
      </div>

      {/* ── 主体 ── */}
      <div className="rk-body">

        {/* ════════════════════════════
            ① 诊断合理性审核
            ════════════════════════════ */}
        <div className="rk-section rk-audit-section">

          {/* 审核状态栏 */}
          <div className="rk-audit-status-bar" style={{ background: aCfg.bg, borderColor: aCfg.border }}>
            <span className="rk-audit-status-icon" style={{ color: aCfg.color }}>{aCfg.icon}</span>
            <div className="rk-audit-status-body">
              <div className="rk-audit-status-row">
                <span className="rk-audit-dx-name">
                  {selectedDiagnosis || MOCK_AUDIT.diagnosis_name}
                </span>
                <span className="rk-audit-status-label" style={{ color: aCfg.color }}>{aCfg.label}</span>
              </div>
              <div className="rk-audit-summary-text">{MOCK_AUDIT.audit_summary}</div>
            </div>
          </div>

          {/* 分组统计胶囊 */}
          <div className="rk-audit-stat-row">
            <span className="rk-audit-stat-chip green">
              支持证据 {MOCK_AUDIT.supporting_evidence.length}
            </span>
            <span className="rk-audit-stat-chip red">
              缺失证据 {MOCK_AUDIT.missing_evidence.filter(m => m.importance === 'critical').length} 关键
            </span>
            <span className="rk-audit-stat-chip orange">
              冲突预警 {MOCK_AUDIT.conflict_alerts.length}
            </span>
            <span className="rk-audit-stat-chip blue">
              鉴别提示 {MOCK_AUDIT.differential_reminders.length}
            </span>
          </div>

          {/* Tab 导航 */}
          <div className="rk-audit-tabs">
            {AUDIT_TABS.map(tab => (
              <button
                key={tab.id}
                className={`rk-audit-tab ${auditTab === tab.id ? 'active' : ''}`}
                onClick={() => setAuditTab(tab.id)}
              >{tab.label}</button>
            ))}
          </div>

          {/* Tab 内容 */}
          <div className="rk-audit-tab-body">

            {/* 支持证据 */}
            {auditTab === 'support' && (
              <div className="rk-ev-list">
                {MOCK_AUDIT.supporting_evidence.map(ev => {
                  const wCfg = EVIDENCE_WEIGHT_CFG[ev.weight]
                  return (
                    <div key={ev.id} className="rk-ev-row">
                      <span
                        className="rk-ev-weight"
                        style={{ color: wCfg.color, background: wCfg.bg }}
                      >{wCfg.label}</span>
                      <div className="rk-ev-body">
                        <div className="rk-ev-text">{ev.text}</div>
                        <div className="rk-ev-source">来源：{ev.source}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 缺失证据 */}
            {auditTab === 'missing' && (
              <div className="rk-missing-list">
                {MOCK_AUDIT.missing_evidence.map(m => {
                  const iCfg   = MISSING_IMPORTANCE_CFG[m.importance]
                  const isOpen = expandedMissing === m.id
                  return (
                    <div
                      key={m.id}
                      className={`rk-missing-row ${isOpen ? 'open' : ''}`}
                      style={{ borderColor: iCfg.border, background: iCfg.bg }}
                    >
                      <div
                        className="rk-missing-main"
                        onClick={() => setExpandedMissing(isOpen ? null : m.id)}
                      >
                        <span
                          className="rk-missing-badge"
                          style={{ color: iCfg.color, borderColor: iCfg.border }}
                        >{iCfg.label}</span>
                        <span className="rk-missing-text">{m.text}</span>
                        <span className={`rk-expand-chevron ${isOpen ? 'open' : ''}`}>›</span>
                      </div>
                      {isOpen && (
                        <div className="rk-missing-detail">
                          <p className="rk-missing-reason">{m.reason}</p>
                          <div className="rk-missing-tests">
                            <span className="rk-missing-tests-label">推荐检查：</span>
                            {m.recommended_tests.map(t => (
                              <span key={t} className="rk-test-tag">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 冲突预警 */}
            {auditTab === 'conflict' && (
              <div className="rk-conflict-list">
                {MOCK_AUDIT.conflict_alerts.map(c => {
                  const lCfg = ALERT_LEVEL_CFG[c.level]
                  return (
                    <div
                      key={c.id}
                      className="rk-conflict-row"
                      style={{ background: lCfg.bg, borderColor: lCfg.border }}
                    >
                      <div className="rk-conflict-header">
                        <span className="rk-conflict-icon">{lCfg.icon}</span>
                        <span className="rk-conflict-title" style={{ color: lCfg.color }}>{c.title}</span>
                      </div>
                      <p className="rk-conflict-detail">{c.detail}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 鉴别诊断提示 */}
            {auditTab === 'differential' && (
              <div className="rk-diff-list">
                {MOCK_AUDIT.differential_reminders.map((d, i) => {
                  const uCfg   = DIFF_URGENCY_CFG[d.urgency]
                  const isOpen = expandedDiff === d.disease
                  return (
                    <div
                      key={i}
                      className={`rk-diff-row ${isOpen ? 'open' : ''}`}
                      style={{ borderColor: uCfg.border }}
                    >
                      <div
                        className="rk-diff-main"
                        style={{ background: uCfg.bg }}
                        onClick={() => setExpandedDiff(isOpen ? null : d.disease)}
                      >
                        <span className="rk-diff-urgency-icon">{uCfg.icon}</span>
                        <span
                          className="rk-diff-urgency-label"
                          style={{ color: uCfg.color }}
                        >{uCfg.label}</span>
                        <span className="rk-diff-disease">{d.disease}</span>
                        <span className={`rk-expand-chevron ${isOpen ? 'open' : ''}`} style={{ color: uCfg.color }}>›</span>
                      </div>
                      {isOpen && (
                        <div className="rk-diff-detail">
                          <p className="rk-diff-reason">{d.reason}</p>
                          <div className="rk-diff-suggest">→ {d.suggest}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 修正建议 */}
          <div className="rk-audit-corr-section">
            <div className="rk-audit-corr-title">修正建议</div>
            <div className="rk-corr-list">
              {MOCK_AUDIT.correction_recommendations.map((r, i) => {
                const cCfg = AUDIT_CORR_CFG[r.type]
                return (
                  <div key={i} className="rk-corr-row">
                    <span className="rk-corr-type" style={{ color: cCfg.color, background: cCfg.bg }}>
                      {cCfg.icon} {cCfg.label}
                    </span>
                    <span className="rk-corr-content">{r.content}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 医生操作区 */}
          <div className="rk-audit-actions">
            {auditAcknowledged ? (
              <div className="rk-audit-acked-bar">
                <span className="rk-acked-check">✓</span>
                <span>
                  已知晓
                  {continueCurrentDx && ' · 继续采用当前诊断'}
                </span>
                <button
                  className="rk-btn-ghost-xs"
                  onClick={() => { setAuditAcknowledged(false); setContinueCurrentDx(false) }}
                >撤销</button>
              </div>
            ) : (
              <div className="rk-audit-btn-row">
                <button className="rk-audit-btn-ack" onClick={handleAcknowledge}>
                  标记"已知晓"
                </button>
                <button className="rk-audit-btn-continue" onClick={handleContinueDx}>
                  继续采用当前诊断
                </button>
                <button className="rk-audit-btn-goto" onClick={handleGoToDiagnosis}>
                  返回辅助诊断
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════
            ② 风险评分总览
            ════════════════════════════ */}
        <div className="rk-section">
          <div className="rk-sec-title">风险评分总览</div>
          <div className="rk-score-grid">
            {MOCK_SCORE_MODELS.map(model => {
              const lCfg   = RISK_LEVEL_CFG[model.level]
              const isOpen = expandedModel === model.name
              const pct    = model.max ? Math.round((Number(model.score) / model.max) * 100) : null
              return (
                <div key={model.name} className={`rk-score-card ${isOpen ? 'open' : ''}`}>
                  <div className="rk-score-header" onClick={() => setExpandedModel(isOpen ? null : model.name)}>
                    <div className="rk-score-top">
                      <span className="rk-score-name">{model.name}</span>
                      <span className="rk-level-badge" style={{ color: lCfg.color, background: lCfg.bg, borderColor: lCfg.border }}>
                        {lCfg.label}
                      </span>
                    </div>
                    <div className="rk-score-row">
                      <span className="rk-score-val" style={{ color: lCfg.color }}>
                        {model.score}
                        {model.max && <span className="rk-score-max"> / {model.max}</span>}
                      </span>
                      {pct !== null && (
                        <div className="rk-score-bar-wrap">
                          <div className="rk-score-bar-fill" style={{ width: `${pct}%`, background: lCfg.border }} />
                        </div>
                      )}
                      <span className={`rk-expand-chevron ${isOpen ? 'open' : ''}`}>›</span>
                    </div>
                    <div className="rk-score-desc">{model.description}</div>
                  </div>
                  {isOpen && (
                    <div className="rk-score-detail">
                      <div className="rk-detail-label">评分因子</div>
                      <div className="rk-factor-list">
                        {model.factors.map(f => (
                          <div key={f.name} className="rk-factor-row">
                            <span className={`rk-factor-dot contrib-${f.contribution}`} />
                            <span className="rk-factor-name">{f.name}</span>
                            <span className="rk-factor-val">{f.value}</span>
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
            ③ 分类风险预警
            ════════════════════════════ */}
        {ALERT_CATEGORIES.map(cat => {
          const alerts = alertsByCategory[cat]
          if (alerts.length === 0) return null
          const maxLevel = alerts.some(a => a.level === 'critical') ? 'critical'
            : alerts.some(a => a.level === 'warning') ? 'warning'
            : alerts.some(a => a.level === 'caution') ? 'caution' : 'info'
          const catCfg = ALERT_LEVEL_CFG[maxLevel]
          return (
            <div key={cat} className="rk-section">
              <div className="rk-sec-title">
                <span className="rk-cat-icon">{CATEGORY_ICONS[cat]}</span>
                {cat}
                <span className="rk-count-badge" style={{ color: catCfg.color, background: catCfg.bg, borderColor: catCfg.border }}>
                  {alerts.length} 项
                </span>
              </div>
              <div className="rk-alert-list">
                {alerts.map(alert => {
                  const aCfg2  = ALERT_LEVEL_CFG[alert.level]
                  const isOpen = expandedAlert === alert.id
                  return (
                    <div key={alert.id} className={`rk-alert-row ${isOpen ? 'open' : ''}`} style={{ borderColor: aCfg2.border, background: aCfg2.bg }}>
                      <div className="rk-alert-main" onClick={() => setExpandedAlert(isOpen ? null : alert.id)}>
                        <span className="rk-alert-icon">{aCfg2.icon}</span>
                        <div className="rk-alert-content">
                          <span className="rk-alert-level-tag" style={{ color: aCfg2.color }}>{aCfg2.label}</span>
                          <span className="rk-alert-title" style={{ color: aCfg2.color }}>{alert.title}</span>
                        </div>
                        <span className={`rk-expand-chevron ${isOpen ? 'open' : ''}`} style={{ color: aCfg2.color }}>›</span>
                      </div>
                      {isOpen && (
                        <div className="rk-alert-detail">
                          <p className="rk-alert-detail-text">{alert.detail}</p>
                          <div className="rk-alert-related">
                            {alert.related.map(r => <span key={r} className="rk-related-tag">{r}</span>)}
                          </div>
                          <div className="rk-alert-action">→ {alert.action}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ════════════════════════════
            ④ 修正建议（风险层面）
            ════════════════════════════ */}
        <div className="rk-section">
          <div className="rk-sec-title">
            修正建议
            <span className="rk-count-badge">{MOCK_SUGGESTIONS.length} 项</span>
            {urgentSugCount > 0 && <span className="rk-urgent-badge">{urgentSugCount} 项紧急</span>}
          </div>
          <div className="rk-sug-list">
            {MOCK_SUGGESTIONS.map((sug, i) => {
              const sCfg = SUGGESTION_CFG[sug.type]
              const pCfg = PRIORITY_CFG[sug.priority]
              return (
                <div key={i} className="rk-sug-row">
                  <span className="rk-sug-type-badge" style={{ color: sCfg.color, background: sCfg.bg }}>
                    {sCfg.icon} {sCfg.label}
                  </span>
                  <div className="rk-sug-content">
                    <div className="rk-sug-title">
                      <span className="rk-sug-priority" style={{ color: pCfg.color }}>[{pCfg.label}]</span>
                      {sug.title}
                    </div>
                    <div className="rk-sug-detail">{sug.content}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ════════════════════════════
            ⑤ 审核摘要
            ════════════════════════════ */}
        <div className="rk-section rk-summary-section">
          <div className="rk-summary-header">
            <div className="rk-sec-title" style={{ margin: 0 }}>审核摘要</div>
            {!summaryGenerated ? (
              <button className="rk-btn-generate" onClick={() => { setSummaryGenerated(true); setSummaryOpen(true) }}>
                生成审核摘要
              </button>
            ) : (
              <button className="rk-btn-toggle" onClick={() => setSummaryOpen(v => !v)}>
                {summaryOpen ? '收起' : '展开'}
              </button>
            )}
          </div>
          {summaryGenerated && summaryOpen && (
            <>
              <pre className="rk-summary-text">{summary}</pre>
              <div className="rk-summary-actions">
                <button className="rk-btn-copy" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '复制摘要'}
                </button>
                <button className="rk-btn-writeback" onClick={openWritebackModal}>
                  回写 HIS
                </button>
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════
            ⑥ 输出操作
            ════════════════════════════ */}
        <div className="rk-action-section">
          {confirmed ? (
            <div className="rk-confirmed-bar">
              <span className="rk-confirmed-check">✓</span>
              <span>已确认查看本次风险审核</span>
              {saved && <span className="rk-saved-tag">已保存</span>}
              <button className="rk-btn-ghost-sm" onClick={() => setConfirmed(false)}>取消确认</button>
            </div>
          ) : (
            <div className="rk-action-row">
              <button className="rk-btn-confirm" onClick={() => { setConfirmed(true); showToast('已确认查看风险审核', 'success') }}>
                确认已查看
              </button>
              <button className="rk-btn-save" onClick={handleSave}>
                保存审核结果
              </button>
              <button className="rk-btn-writeback-main" onClick={openWritebackModal}>
                回写 HIS
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
