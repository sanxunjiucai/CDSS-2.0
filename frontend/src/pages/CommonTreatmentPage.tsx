import { useState, useMemo } from 'react'
import { useAppStore } from '../store'
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

// ── Mock 方案数据 ─────────────────────────────────────

const MOCK_PLANS: TreatmentPlanFull[] = [
  {
    plan_id: 'T001',
    plan_name: '标准抗心绞痛方案',
    plan_level: '首选',
    indication: '适用于不稳定型心绞痛初始稳定化治疗，无抗凝禁忌证患者',
    medications: [
      { group: '抗血小板',  name: '阿司匹林肠溶片',   dose: '100 mg',   route: '口服', frequency: 'qd',  note: '餐前服用' },
      { group: '抗血小板',  name: '氯吡格雷片',       dose: '75 mg',    route: '口服', frequency: 'qd',  note: '双联抗血小板' },
      { group: '抗心绞痛',  name: '单硝酸异山梨酯片', dose: '20 mg',    route: '口服', frequency: 'bid', note: '防止耐药需留空窗期' },
      { group: '控制心率',  name: '美托洛尔缓释片',   dose: '47.5 mg',  route: '口服', frequency: 'qd'  },
      { group: '调脂',      name: '阿托伐他汀钙片',   dose: '20 mg',    route: '口服', frequency: 'qn',  note: '监测肝功能' },
    ],
    non_drug: ['适当卧床休息，避免剧烈活动', '持续监测心率、血压、心电图', '低盐低脂饮食，限制饱和脂肪', '戒烟限酒，控制血糖'],
    basis: '依据 ACC/AHA 2022 不稳定型心绞痛指南推荐（I 类推荐，A 级证据）',
    caution: '青霉素过敏患者无需特殊调整；血糖控制不佳者注意美托洛尔对低血糖感知的影响',
  },
  {
    plan_id: 'T002',
    plan_name: '保守药物治疗方案',
    plan_level: '备选',
    indication: '适用于症状较轻、血流动力学稳定、近期出血风险偏高的患者',
    medications: [
      { group: '抗血小板',  name: '阿司匹林肠溶片',   dose: '100 mg', route: '口服', frequency: 'qd' },
      { group: '降压',      name: '苯磺酸氨氯地平片', dose: '5 mg',   route: '口服', frequency: 'qd' },
      { group: '调脂',      name: '瑞舒伐他汀钙片',   dose: '10 mg',  route: '口服', frequency: 'qn' },
    ],
    non_drug: ['低强度运动康复', '心率/血压定期监测', '低盐低脂饮食'],
    basis: '基于患者出血风险评估，参考 GRACE 评分低危层次用药策略',
    caution: '若症状加重或心电图改变，需升级为标准方案',
  },
  {
    plan_id: 'T003',
    plan_name: '强化治疗方案',
    plan_level: '强化',
    indication: '适用于 GRACE 评分高危、反复发作心绞痛或血流动力学不稳定患者',
    medications: [
      { group: '抗血小板',  name: '阿司匹林肠溶片',   dose: '100 mg',  route: '口服',   frequency: 'qd'   },
      { group: '抗血小板',  name: '替格瑞洛片',       dose: '90 mg',   route: '口服',   frequency: 'bid',  note: '强效 P2Y12 抑制剂' },
      { group: '抗凝',      name: '低分子肝素钠',      dose: '4000 IU', route: '皮下注射', frequency: 'q12h', note: '用药 3~5 天后评估' },
      { group: '控制心率',  name: '美托洛尔缓释片',   dose: '47.5 mg', route: '口服',   frequency: 'qd'   },
      { group: '调脂',      name: '阿托伐他汀钙片',   dose: '40 mg',   route: '口服',   frequency: 'qn',   note: '强化降脂' },
    ],
    non_drug: ['ICU/CCU 监护', '绝对卧床', '持续心电监护', '建立静脉通路'],
    basis: 'ESC 2023 ACS 指南强化抗栓策略（I 类推荐，B 级证据）',
    caution: '密切监测出血风险；替格瑞洛可能引起呼吸困难，需告知患者',
  },
]

// ── 摘要生成 ──────────────────────────────────────────

function buildSummary(
  plan: TreatmentPlanFull,
  diagnosis: string,
  patientName: string,
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

export default function CommonTreatmentPage() {
  const {
    selectedCommonPlan, setSelectedCommonPlan,
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal,
  } = useAppStore()

  const [summaryOpen, setSummaryOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const currentPlan = MOCK_PLANS.find(p => p.plan_id === selectedCommonPlan) ?? MOCK_PLANS[0]

  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  const summary = useMemo(
    () => buildSummary(currentPlan, selectedDiagnosis, patientContext?.name ?? '', now),
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
    showToast(`已切换参考方案：${MOCK_PLANS.find(p => p.plan_id === planId)?.plan_name}`, 'info')
  }

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
              &ensp;·&ensp;{MOCK_PLANS.length} 个参考方案
            </div>
          </div>
        </div>
      </div>

      {/* ── 方案选择条 ── */}
      <div className="ct-plan-strip">
        <span className="ct-strip-label">参考方案</span>
        {MOCK_PLANS.map(plan => {
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
