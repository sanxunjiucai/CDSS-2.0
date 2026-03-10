import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store'
import { fetchPersonalizedTreatments } from '../api/endpoints'
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

  const [apiPlan, setApiPlan]               = useState<PersonalizedPlanFull | null>(null)
  const [loading, setLoading]               = useState(false)
  const [expandedAlt, setExpandedAlt]       = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen]       = useState(false)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [copied, setCopied]                 = useState(false)

  useEffect(() => {
    if (!selectedDiagnosis) return
    setLoading(true)
    // patientContext may be null; pass a safe fallback so the API can still respond
    const ctx = patientContext ?? {
      patient_id: '', name: '', gender: '', age: 0, department: '',
      visit_id: '', chief_complaint: '', present_illness: '',
      past_history: '', chronic_diseases: [], allergies: [], risk_tags: [],
    }
    fetchPersonalizedTreatments(selectedDiagnosis, ctx)
      .then(results => {
        if (!results || results.length === 0) return
        const p = results[0]
        setApiPlan({
          plan_id: p.plan_id,
          plan_name: p.plan_name,
          base_plan_name: '标准方案',
          patient_factors: [
            ...(ctx.chronic_diseases ?? []),
            ...(ctx.risk_tags ?? []),
          ],
          adjustments: (p.adjustments ?? []).map(text => ({
            type: 'replace' as AdjustType,
            description: text,
            adjusted: text,
            reason: '',
            tag: '',
          })),
          medications: (p.medications ?? []).map(m => ({
            group: '',
            name: m.name,
            dose: m.dose,
            route: m.route,
            frequency: '',
            is_adjusted: false,
          })),
          cautions: (p.contraindications ?? []).map(drug => ({
            drug,
            level: 'caution' as CautionLevel,
            message: `${drug} 禁忌或需注意，请参考个性化调整说明`,
            action: '遵医嘱处理',
          })),
          monitors: [],
          alternatives: [],
        })
      })
      .catch(err => console.error('fetchPersonalizedTreatments failed', err))
      .finally(() => setLoading(false))
  }, [selectedDiagnosis, patientContext])

  const plan = apiPlan
  const isAdopted = plan ? selectedPersonalizedPlan === plan.plan_id : false

  const summary = useMemo(() => plan ? buildSummary(
    plan,
    selectedDiagnosis,
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
  ) : '', [plan, selectedDiagnosis, patientContext])

  const handleAdopt = () => {
    if (!plan) return
    setSelectedPersonalizedPlan(plan.plan_id)
    showToast('已标记为当前采用方案', 'success')
  }

  if (loading) return <div className="page pt-page"><p style={{ padding: 24, color: '#888' }}>正在加载个性化方案…</p></div>
  if (!plan) return <div className="page pt-page"><p style={{ padding: 24, color: '#888' }}>暂无个性化方案，请先确认诊断。</p></div>

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
