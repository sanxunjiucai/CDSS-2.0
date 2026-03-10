import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store'
import { fetchCommonTreatments } from '../api/endpoints'
import './common.css'
import './CommonTreatmentPage.css'

// ── 类型 ─────────────────────────────────────────────

interface Medication {
  group: string         // 用药类别（抗血小板 / 降压 / 调脂…）
  name: string
  dose: string
  route: string
  frequency: string
  note?: string
}

interface TreatmentPlanFull {
  plan_id: string
  plan_name: string
  plan_level: '首选' | '备选' | '强化'
  indication: string    // 适应说明
  medications: Medication[]
  non_drug: string[]
  basis: string         // 循证依据
  caution?: string      // 注意事项
}

// ── 摘要生成 ──────────────────────────────────────────

function buildSummary(
  plan: TreatmentPlanFull,
  diagnosis: string,
  _patientName: string,
  now: string,
): string {
  const medGroups = plan.medications.reduce<Record<string, Medication[]>>((acc, m) => {
    acc[m.group] = acc[m.group] ?? []
    acc[m.group].push(m)
    return acc
  }, {})

  const medLines = Object.entries(medGroups).map(([group, meds], gi) =>
    `${gi + 1}. ${group}\n` +
    meds.map(m => `   · ${m.name} ${m.dose} ${m.route} ${m.frequency}${m.note ? `（${m.note}）` : ''}`).join('\n')
  ).join('\n')

  const nonDrugLines = plan.non_drug.map(t => `• ${t}`).join('\n')

  return [
    '【通用治疗摘要】',
    `诊断：${diagnosis || '（待确认）'}`,
    `参考方案：${plan.plan_name}（${plan.plan_level}）`,
    `适用说明：${plan.indication}`,
    '',
    '【药物治疗】',
    medLines,
    '',
    '【非药物治疗】',
    nonDrugLines,
    '',
    `【循证依据】\n${plan.basis}`,
    plan.caution ? `\n【注意事项】\n${plan.caution}` : '',
    '',
    `生成时间：${now}`,
  ].filter(l => l !== undefined).join('\n')
}

// ── 工具 ─────────────────────────────────────────────

const LEVEL_COLOR: Record<TreatmentPlanFull['plan_level'], { bg: string; color: string }> = {
  '首选': { bg: '#eaf4fd', color: '#1a6fa8' },
  '备选': { bg: '#fef9ec', color: '#d68910' },
  '强化': { bg: '#fdedec', color: '#c0392b' },
}

const GROUP_COLORS: Record<string, string> = {
  '抗血小板': '#2980b9',
  '抗凝':     '#8e44ad',
  '抗心绞痛': '#16a085',
  '控制心率': '#2c3e50',
  '降压':     '#27ae60',
  '调脂':     '#d35400',
}

// ── 主组件 ────────────────────────────────────────────

const PLAN_LEVELS: TreatmentPlanFull['plan_level'][] = ['首选', '备选', '强化']

export default function CommonTreatmentPage() {
  const {
    selectedCommonPlan, setSelectedCommonPlan,
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal,
  } = useAppStore()

  const [plans, setPlans]             = useState<TreatmentPlanFull[]>([])
  const [loading, setLoading]         = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [copied, setCopied]           = useState(false)

  useEffect(() => {
    if (!selectedDiagnosis) return
    setLoading(true)
    fetchCommonTreatments(selectedDiagnosis)
      .then(results => {
        setPlans(results.map((p, i) => ({
          plan_id: p.plan_id,
          plan_name: p.plan_name,
          plan_level: PLAN_LEVELS[i] ?? '备选',
          indication: p.description,
          medications: (p.medications ?? []).map(m => ({
            group: '',
            name: m.name,
            dose: m.dose,
            route: m.route,
            frequency: '',
          })),
          non_drug: p.non_drug_treatments ?? [],
          basis: '',
          caution: (p.contraindications ?? []).length ? (p.contraindications ?? []).join('；') : undefined,
        })))
      })
      .catch(err => console.error('fetchCommonTreatments failed', err))
      .finally(() => setLoading(false))
  }, [selectedDiagnosis])

  const currentPlan = plans.find(p => p.plan_id === selectedCommonPlan) ?? plans[0]

  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  const summary = useMemo(
    () => currentPlan ? buildSummary(currentPlan, selectedDiagnosis, patientContext?.name ?? '', now) : '',
    [currentPlan, selectedDiagnosis, patientContext?.name]
  )

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      showToast('治疗摘要已复制到剪贴板', 'info')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  const handleSelect = (planId: string) => {
    setSelectedCommonPlan(planId)
    setSummaryOpen(false)   // 切换方案时收起摘要，防止内容错位
    showToast(`已切换参考方案：${plans.find(p => p.plan_id === planId)?.plan_name}`, 'info')
  }

  if (loading) return <div className="page ct-page"><p style={{ padding: 24, color: '#888' }}>正在加载治疗方案…</p></div>
  if (!currentPlan) return <div className="page ct-page"><p style={{ padding: 24, color: '#888' }}>暂无治疗方案，请先确认诊断。</p></div>

  return (
    <div className="page ct-page">

      {/* ── 页头 ── */}
      <div className="ct-header">
        <div className="ct-header-left">
          <span className="ct-page-icon">＋</span>
          <div>
            <div className="ct-page-title">通用治疗方案</div>
            <div className="ct-page-sub">
              {selectedDiagnosis
                ? `基于诊断：${selectedDiagnosis}`
                : '基于患者信息智能推荐'}
              &ensp;·&ensp;{plans.length} 个参考方案
            </div>
          </div>
        </div>
      </div>

      {/* ── 方案选择条 ── */}
      <div className="ct-plan-strip">
        <span className="ct-strip-label">参考方案</span>
        {plans.map(plan => {
          const lv = LEVEL_COLOR[plan.plan_level]
          const isActive = currentPlan.plan_id === plan.plan_id
          return (
            <button
              key={plan.plan_id}
              className={`ct-plan-chip ${isActive ? 'active' : ''}`}
              onClick={() => handleSelect(plan.plan_id)}
            >
              <span className="ct-chip-level" style={{ color: lv.color, background: lv.bg }}>
                {plan.plan_level}
              </span>
              {plan.plan_name}
            </button>
          )
        })}
      </div>

      {/* ── 方案详情 ── */}
      <div className="ct-body">

        {/* 适用说明 */}
        <div className="ct-section">
          <div className="ct-section-title">
            <span className="ct-plan-name">{currentPlan.plan_name}</span>
            <span
              className="ct-level-badge"
              style={{ color: LEVEL_COLOR[currentPlan.plan_level].color, background: LEVEL_COLOR[currentPlan.plan_level].bg }}
            >{currentPlan.plan_level}</span>
          </div>
          <p className="ct-indication">{currentPlan.indication}</p>
        </div>

        {/* 药物治疗表格 */}
        <div className="ct-section">
          <div className="ct-sec-title">药物治疗</div>
          <table className="ct-med-table">
            <thead>
              <tr>
                <th>类别</th>
                <th>药品名称</th>
                <th>剂量</th>
                <th>途径</th>
                <th>频次</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {currentPlan.medications.map((med, i) => (
                <tr key={i}>
                  <td>
                    <span
                      className="ct-group-dot"
                      style={{ background: GROUP_COLORS[med.group] ?? '#999' }}
                    />
                    {med.group}
                  </td>
                  <td className="ct-med-name">{med.name}</td>
                  <td>{med.dose}</td>
                  <td>{med.route}</td>
                  <td><span className="ct-freq">{med.frequency}</span></td>
                  <td className="ct-note">{med.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 非药物治疗 */}
        <div className="ct-section">
          <div className="ct-sec-title">非药物治疗</div>
          <div className="ct-non-drug">
            {currentPlan.non_drug.map((item, i) => (
              <div key={i} className="ct-non-drug-item">
                <span className="ct-bullet">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 循证依据 + 注意事项 */}
        <div className="ct-section ct-section-row">
          <div className="ct-basis">
            <div className="ct-sec-title">循证依据</div>
            <p className="ct-basis-text">{currentPlan.basis}</p>
          </div>
          {currentPlan.caution && (
            <div className="ct-caution">
              <div className="ct-sec-title">⚠ 注意事项</div>
              <p className="ct-caution-text">{currentPlan.caution}</p>
            </div>
          )}
        </div>

        {/* ── 治疗摘要面板 ── */}
        <div className="ct-section ct-summary-section">
          <div
            className="ct-summary-toggle"
            onClick={() => setSummaryOpen(v => !v)}
          >
            <span className="ct-sec-title" style={{ margin: 0 }}>治疗摘要</span>
            <span className="ct-summary-hint">点击{summaryOpen ? '收起' : '展开'}摘要文本</span>
            <span className={`ct-chevron ${summaryOpen ? 'open' : ''}`}>›</span>
          </div>

          {summaryOpen && (
            <>
              <pre className="ct-summary-text">{summary}</pre>
              <div className="ct-summary-actions">
                <button className="ct-btn-copy" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '复制摘要'}
                </button>
                <button className="ct-btn-writeback" onClick={openWritebackModal}>
                  回写 HIS
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
