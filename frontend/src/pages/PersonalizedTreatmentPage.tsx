import { useState, useMemo } from 'react'
import { useAppStore } from '../store'
import './common.css'
import './PersonalizedTreatmentPage.css'

// ── 类型 ─────────────────────────────────────────────

type AdjustType = 'replace' | 'add' | 'remove' | 'dose_adjust'
type CautionLevel = 'warning' | 'caution' | 'info'

interface AdjustedMed {
  group: string
  name: string
  dose: string
  route: string
  frequency: string
  is_adjusted: boolean          // 是否为调整项
  adjust_type?: AdjustType
  replaced_from?: string        // 替换自哪个药
  reason?: string               // 调整原因
}

interface AdjustItem {
  type: AdjustType
  description: string           // 简短标题
  original?: string
  adjusted: string
  reason: string
  tag: string                   // 触发因素（如"青霉素过敏"）
}

interface CautionItem {
  drug: string
  level: CautionLevel
  message: string
  action: string                // 处置建议
}

interface MonitorIndicator {
  name: string
  target: string
  frequency: string
  icon: string
}

interface AlternativePlan {
  id: string
  condition: string             // 触发条件
  title: string
  medications: { name: string; dose: string; frequency: string }[]
  reason: string
}

interface PersonalizedPlanFull {
  plan_id: string
  plan_name: string
  base_plan_name: string
  patient_factors: string[]     // 触发个性化的患者因素
  adjustments: AdjustItem[]
  medications: AdjustedMed[]
  cautions: CautionItem[]
  monitors: MonitorIndicator[]
  alternatives: AlternativePlan[]
}

// ── Mock 数据 ─────────────────────────────────────────

const MOCK_PLANS: PersonalizedPlanFull[] = [
  {
    plan_id: 'P001',
    plan_name: '个性化调整方案（主推荐）',
    base_plan_name: '标准抗心绞痛方案',
    patient_factors: ['血糖控制不佳', '青霉素过敏', '心血管高危', '高血压'],
    adjustments: [
      {
        type: 'replace',
        description: '美托洛尔 → 比索洛尔',
        original: '美托洛尔缓释片 47.5mg qd',
        adjusted: '比索洛尔片 2.5mg qd',
        reason: '血糖控制不佳时，美托洛尔（非选择性β阻滞剂）可掩盖低血糖症状；比索洛尔选择性更强，对血糖影响小。',
        tag: '血糖控制不佳',
      },
      {
        type: 'dose_adjust',
        description: '阿托伐他汀维持 20mg（不强化）',
        original: '阿托伐他汀 20mg qn',
        adjusted: '阿托伐他汀 20mg qn（维持，不强化至 40mg）',
        reason: '糖尿病患者大剂量他汀轻度升高血糖风险；当前血糖控制欠佳，维持 20mg 在获益与风险中取得平衡。',
        tag: '血糖控制不佳',
      },
      {
        type: 'add',
        description: '新增 ACEI：培哚普利',
        adjusted: '培哚普利片 4mg qd',
        reason: '高血压合并糖尿病患者，ACEI 为优选降压药，同时具有肾脏保护作用（减少蛋白尿）。',
        tag: '高血压 + 糖尿病',
      },
    ],
    medications: [
      { group: '抗血小板',  name: '阿司匹林肠溶片', dose: '100mg', route: '口服', frequency: 'qd',  is_adjusted: false },
      { group: '抗血小板',  name: '氯吡格雷片',     dose: '75mg',  route: '口服', frequency: 'qd',  is_adjusted: false },
      { group: '抗心绞痛', name: '单硝酸异山梨酯片', dose: '20mg',  route: '口服', frequency: 'bid', is_adjusted: false },
      { group: '控制心率',  name: '比索洛尔片',     dose: '2.5mg', route: '口服', frequency: 'qd',  is_adjusted: true, adjust_type: 'replace', replaced_from: '美托洛尔缓释片', reason: '血糖控制不佳' },
      { group: '调脂',      name: '阿托伐他汀钙片', dose: '20mg',  route: '口服', frequency: 'qn',  is_adjusted: true, adjust_type: 'dose_adjust', reason: '血糖控制不佳' },
      { group: '降压/肾保护', name: '培哚普利片',  dose: '4mg',   route: '口服', frequency: 'qd',  is_adjusted: true, adjust_type: 'add', reason: '高血压 + 糖尿病' },
    ],
    cautions: [
      { drug: '比索洛尔',    level: 'caution',  message: 'β阻滞剂仍可能减弱心率等低血糖预警信号，需增加血糖自我监测频率。',  action: '血糖监测≥2次/天' },
      { drug: '培哚普利',    level: 'warning',  message: '启用 ACEI 1~2 周需复查血钾及肌酐，避免高钾血症及急性肾损伤。',    action: '2周内复查电解质+肌酐' },
      { drug: '阿托伐他汀',  level: 'caution',  message: '他汀类轻度升高空腹血糖，合并糖尿病患者需监测 HbA1c 变化。',       action: '3月后复查肝功能+HbA1c' },
      { drug: '氯吡格雷',    level: 'info',     message: '注意与质子泵抑制剂（奥美拉唑）的 CYP2C19 代谢相互作用。',         action: '必要时换用泮托拉唑' },
    ],
    monitors: [
      { name: '血糖',     target: '空腹 4.4–7.0 mmol/L',  frequency: '每日监测',     icon: '🩸' },
      { name: '血压',     target: '< 130/80 mmHg',         frequency: '每日',         icon: '🫀' },
      { name: '心率',     target: '55–65 次/分',           frequency: '每日',         icon: '📈' },
      { name: '血钾',     target: '3.5–5.0 mmol/L',       frequency: '2周后复查',    icon: '⚗' },
      { name: 'eGFR/肌酐', target: '> 60 mL/min/1.73m²',  frequency: '3月复查',      icon: '🔬' },
      { name: 'HbA1c',   target: '< 7.0%',               frequency: '每3月',        icon: '📊' },
      { name: '肝功能',   target: 'ALT < 3×ULN',          frequency: '他汀用药3月',  icon: '🧪' },
    ],
    alternatives: [
      {
        id: 'A001',
        condition: 'β阻滞剂禁忌或不耐受（如重度哮喘、II度房室传导阻滞）',
        title: '地尔硫卓方案（心率控制替代）',
        medications: [
          { name: '地尔硫卓缓释片', dose: '60mg', frequency: 'bid' },
        ],
        reason: '地尔硫卓为非二氢吡啶类钙拮抗剂，具有心率控制作用，可替代β阻滞剂用于心绞痛及高血压。',
      },
      {
        id: 'A002',
        condition: '他汀类不耐受（肌痛、肌酶升高 > 5×ULN）',
        title: '依折麦布 + 低剂量他汀方案',
        medications: [
          { name: '依折麦布片',   dose: '10mg',  frequency: 'qd' },
          { name: '瑞舒伐他汀片', dose: '5mg',   frequency: 'qn' },
        ],
        reason: '依折麦布抑制肠道胆固醇吸收，与低剂量他汀联用可维持降脂效果，同时降低肌肉毒性风险。',
      },
      {
        id: 'A003',
        condition: '双联抗血小板出血风险高（PRECISE-DAPT 评分 ≥ 25 分）',
        title: '单抗血小板方案',
        medications: [
          { name: '阿司匹林肠溶片', dose: '100mg', frequency: 'qd' },
        ],
        reason: '出血高危患者，权衡缺血与出血风险后可缩短 DAPT 疗程或转为单抗。',
      },
    ],
  },
]

// ── 工具 ─────────────────────────────────────────────

const ADJUST_LABELS: Record<AdjustType, { label: string; color: string; bg: string }> = {
  replace:    { label: '替换',   color: '#2980b9', bg: '#eaf4fd' },
  add:        { label: '新增',   color: '#27ae60', bg: '#eafaf1' },
  remove:     { label: '停用',   color: '#e74c3c', bg: '#fdedec' },
  dose_adjust:{ label: '调整剂量', color: '#d68910', bg: '#fef9ec' },
}

const CAUTION_CONFIG: Record<CautionLevel, { icon: string; color: string; bg: string; border: string }> = {
  warning: { icon: '⚠', color: '#c0392b', bg: '#fdedec', border: '#f1948a' },
  caution: { icon: '⚡', color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  info:    { icon: 'ℹ', color: '#2980b9', bg: '#eaf4fd', border: '#aed6f1' },
}

const GROUP_COLORS: Record<string, string> = {
  '抗血小板':    '#2980b9',
  '抗凝':        '#8e44ad',
  '抗心绞痛':    '#16a085',
  '控制心率':    '#2c3e50',
  '降压/肾保护': '#27ae60',
  '调脂':        '#d35400',
}

// ── 摘要生成 ──────────────────────────────────────────

function buildSummary(
  plan: PersonalizedPlanFull,
  diagnosis: string,
  patientName: string,
  visitId: string,
): string {
  const adjustLines = plan.adjustments.map((a, i) =>
    `${i + 1}. [${ADJUST_LABELS[a.type].label}] ${a.description}\n   依据：${a.reason}`
  ).join('\n')

  const medLines = plan.medications.map(m =>
    `${m.is_adjusted ? '★ ' : '  '}${m.name} ${m.dose} ${m.route} ${m.frequency}` +
    (m.replaced_from ? `（替换自 ${m.replaced_from}）` : '') +
    (m.reason ? `  ← ${m.reason}` : '')
  ).join('\n')

  const cautionLines = plan.cautions.map(c =>
    `[${c.level === 'warning' ? '⚠警告' : c.level === 'caution' ? '⚡注意' : 'ℹ提示'}] ${c.drug}：${c.message}\n  处置：${c.action}`
  ).join('\n')

  const monitorLines = plan.monitors.map(m =>
    `· ${m.name}  目标：${m.target}  频率：${m.frequency}`
  ).join('\n')

  return [
    '【个性化治疗方案摘要】',
    `患者：${patientName || '—'}   就诊号：${visitId || '—'}`,
    `诊断：${diagnosis || '（待确认）'}`,
    `基础方案：${plan.base_plan_name}`,
    `患者特征：${plan.patient_factors.join('、')}`,
    '',
    '【个性化调整项（共 ' + plan.adjustments.length + ' 项）】',
    adjustLines,
    '',
    '【调整后用药方案】（★ 为调整项）',
    medLines,
    '',
    '【共治风险 — 药物慎用】',
    cautionLines,
    '',
    '【重点观察指标】',
    monitorLines,
    '',
    `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
  ].join('\n')
}

// ── 主组件 ────────────────────────────────────────────

export default function PersonalizedTreatmentPage() {
  const {
    selectedPersonalizedPlan, setSelectedPersonalizedPlan,
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal,
  } = useAppStore()

  const [expandedAlt, setExpandedAlt]       = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen]       = useState(false)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [copied, setCopied]                 = useState(false)

  const plan = MOCK_PLANS[0]   // 当前只有1个个性化方案
  const isAdopted = selectedPersonalizedPlan === plan.plan_id

  const summary = useMemo(() => buildSummary(
    plan,
    selectedDiagnosis,
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
  ), [plan, selectedDiagnosis, patientContext])

  const handleAdopt = () => {
    setSelectedPersonalizedPlan(plan.plan_id)
    showToast('已标记为当前采用方案', 'success')
  }

  const handleGenerateSummary = () => {
    setSummaryGenerated(true)
    setSummaryOpen(true)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      showToast('个性化方案摘要已复制到剪贴板', 'info')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  return (
    <div className="page pt-page">

      {/* ── 页头 ── */}
      <div className="pt-header">
        <div className="pt-header-left">
          <span className="pt-page-icon">★</span>
          <div>
            <div className="pt-page-title">个性化治疗方案</div>
            <div className="pt-page-sub">基于患者特征深度调整 · {plan.adjustments.length} 项个性化修改</div>
          </div>
        </div>
        {isAdopted && <span className="pt-adopted-global">✓ 当前采用</span>}
      </div>

      {/* ── 患者特征条 ── */}
      <div className="pt-factors-strip">
        <span className="pt-strip-label">调整依据</span>
        {plan.patient_factors.map(f => (
          <span key={f} className="pt-factor-chip">{f}</span>
        ))}
        <span className="pt-strip-sub">基于：{plan.base_plan_name}</span>
      </div>

      {/* ── 主体滚动区 ── */}
      <div className="pt-body">

        {/* ① 调整项列表 */}
        <div className="pt-section">
          <div className="pt-sec-title">
            个性化调整项
            <span className="pt-count-badge">{plan.adjustments.length} 项</span>
          </div>
          <div className="pt-adj-list">
            {plan.adjustments.map((adj, i) => {
              const cfg = ADJUST_LABELS[adj.type]
              return (
                <div key={i} className="pt-adj-row">
                  <span className="pt-adj-badge" style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                  <div className="pt-adj-content">
                    <div className="pt-adj-title">{adj.description}</div>
                    {adj.original && (
                      <div className="pt-adj-from">原：{adj.original}</div>
                    )}
                    <div className="pt-adj-reason">{adj.reason}</div>
                    <span className="pt-adj-tag">{adj.tag}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ② 调整后用药方案 */}
        <div className="pt-section">
          <div className="pt-sec-title">
            调整后用药方案
            <span className="pt-legend">
              <span className="pt-legend-dot" style={{ background: '#f39c12' }} />已调整项
            </span>
          </div>
          <table className="pt-med-table">
            <thead>
              <tr>
                <th>类别</th>
                <th>药品名称</th>
                <th>剂量</th>
                <th>途径</th>
                <th>频次</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {plan.medications.map((med, i) => (
                <tr key={i} className={med.is_adjusted ? 'pt-row-adjusted' : ''}>
                  <td>
                    <span className="pt-group-dot" style={{ background: GROUP_COLORS[med.group] ?? '#999' }} />
                    {med.group}
                  </td>
                  <td className="pt-med-name">
                    {med.is_adjusted && <span className="pt-adj-star">★</span>}
                    {med.name}
                    {med.replaced_from && (
                      <span className="pt-replaced-from"> ← {med.replaced_from}</span>
                    )}
                  </td>
                  <td>{med.dose}</td>
                  <td>{med.route}</td>
                  <td><span className="pt-freq">{med.frequency}</span></td>
                  <td className="pt-med-note">
                    {med.reason
                      ? <span className="pt-adj-reason-inline">{med.reason}</span>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ③ 共治风险 */}
        <div className="pt-section">
          <div className="pt-sec-title">共治风险 — 药物慎用提示</div>
          <div className="pt-caution-list">
            {plan.cautions.map((c, i) => {
              const cfg = CAUTION_CONFIG[c.level]
              return (
                <div key={i} className="pt-caution-row" style={{ background: cfg.bg, borderColor: cfg.border }}>
                  <span className="pt-caution-icon" style={{ color: cfg.color }}>{cfg.icon}</span>
                  <div className="pt-caution-body">
                    <div className="pt-caution-drug" style={{ color: cfg.color }}>{c.drug}</div>
                    <div className="pt-caution-msg">{c.message}</div>
                    <div className="pt-caution-action">→ {c.action}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ④ 重点观察指标 */}
        <div className="pt-section">
          <div className="pt-sec-title">重点观察指标</div>
          <div className="pt-monitor-grid">
            {plan.monitors.map((m, i) => (
              <div key={i} className="pt-monitor-card">
                <div className="pt-monitor-icon">{m.icon}</div>
                <div className="pt-monitor-name">{m.name}</div>
                <div className="pt-monitor-target">{m.target}</div>
                <div className="pt-monitor-freq">{m.frequency}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ⑤ 备选方案 */}
        <div className="pt-section">
          <div className="pt-sec-title">
            备选方案
            <span className="pt-count-badge">{plan.alternatives.length} 项</span>
          </div>
          <div className="pt-alt-list">
            {plan.alternatives.map(alt => {
              const isOpen = expandedAlt === alt.id
              return (
                <div key={alt.id} className={`pt-alt-card ${isOpen ? 'open' : ''}`}>
                  <div className="pt-alt-header" onClick={() => setExpandedAlt(isOpen ? null : alt.id)}>
                    <div className="pt-alt-header-left">
                      <span className="pt-alt-condition">{alt.condition}</span>
                    </div>
                    <div className="pt-alt-title-row">
                      <span className="pt-alt-title">{alt.title}</span>
                      <span className={`pt-alt-chevron ${isOpen ? 'open' : ''}`}>›</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="pt-alt-detail">
                      <div className="pt-alt-meds">
                        {alt.medications.map((m, i) => (
                          <span key={i} className="pt-alt-med-chip">
                            {m.name} {m.dose} {m.frequency}
                          </span>
                        ))}
                      </div>
                      <p className="pt-alt-reason">{alt.reason}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ⑥ 个体化方案摘要 */}
        <div className="pt-section pt-summary-section">
          <div className="pt-summary-header">
            <div className="pt-sec-title" style={{ margin: 0 }}>个体化方案摘要</div>
            {!summaryGenerated ? (
              <button className="pt-btn-generate" onClick={handleGenerateSummary}>
                一键生成摘要
              </button>
            ) : (
              <button
                className="pt-btn-toggle"
                onClick={() => setSummaryOpen(v => !v)}
              >{summaryOpen ? '收起' : '展开'}</button>
            )}
          </div>

          {summaryGenerated && summaryOpen && (
            <>
              <pre className="pt-summary-text">{summary}</pre>
              <div className="pt-summary-actions">
                <button className="pt-btn-copy" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '复制摘要'}
                </button>
                <button className="pt-btn-writeback" onClick={openWritebackModal}>
                  回写 HIS
                </button>
              </div>
            </>
          )}
        </div>

        {/* ⑦ 主操作 */}
        <div className="pt-action-row">
          {isAdopted ? (
            <div className="pt-adopted-bar">
              <span className="pt-adopted-check">✓</span>
              <span>已标记为当前采用方案</span>
              <button className="pt-btn-ghost-sm" onClick={() => setSelectedPersonalizedPlan('')}>
                取消标记
              </button>
            </div>
          ) : (
            <button className="pt-btn-adopt" onClick={handleAdopt}>
              标记为当前采用方案
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
