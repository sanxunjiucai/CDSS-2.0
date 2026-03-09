import { useState, useMemo } from 'react'
import { useAppStore } from '../store'
import './common.css'
import './TestsPage.css'

// ── 类型 ─────────────────────────────────────────────

type TestPriority = 'required' | 'recommended' | 'optional'
type TestCategory = '实验室检验' | '影像检查' | '功能检查'
type ResultStatus = 'pending' | 'ordered' | 'completed' | 'abnormal'

interface TestItem {
  test_id: string
  category: TestCategory
  name: string
  priority: TestPriority
  indication: string      // 推荐理由
  sample: string          // 采样/检查说明
  turnaround: string      // 预计出结果时间
  cpt_code?: string       // 检查代码（预留）
  tags: string[]          // 关联病情标签
}

// ── Mock 数据 ─────────────────────────────────────────

const MOCK_TESTS: TestItem[] = [
  // ── 实验室检验 ──
  {
    test_id: 'L001',
    category: '实验室检验',
    name: '心肌酶谱（CK / CK-MB / LDH）',
    priority: 'required',
    indication: '鉴别急性心肌损伤与不稳定型心绞痛，排除 AMI，评估心肌坏死范围。',
    sample: '空腹静脉血 3 ml，EDTA 管',
    turnaround: '约 2 小时',
    tags: ['急性心肌损伤', '不稳定型心绞痛'],
  },
  {
    test_id: 'L002',
    category: '实验室检验',
    name: '高敏肌钙蛋白 I / T（hs-cTn）',
    priority: 'required',
    indication: '高灵敏度检测心肌损伤标志物，是 ACS 早期诊断与危险分层核心指标（ESC 0h/1h 方案）。',
    sample: '静脉血 2 ml，间隔 1 小时复测',
    turnaround: '约 1 小时',
    tags: ['ACS', '危险分层'],
  },
  {
    test_id: 'L003',
    category: '实验室检验',
    name: 'BNP / NT-proBNP',
    priority: 'recommended',
    indication: '评估心力衰竭合并风险，高值提示左室功能受损，辅助判断血流动力学状态。',
    sample: '静脉血 2 ml',
    turnaround: '约 2 小时',
    tags: ['心力衰竭', '左室功能'],
  },
  {
    test_id: 'L004',
    category: '实验室检验',
    name: '血脂全套（TC / TG / LDL-C / HDL-C）',
    priority: 'required',
    indication: '患者调脂治疗在院，需评估血脂基线及他汀疗效，LDL-C 目标 < 1.8 mmol/L。',
    sample: '空腹 8 h，静脉血 3 ml',
    turnaround: '约 2 小时',
    tags: ['血脂管理', '他汀监测'],
  },
  {
    test_id: 'L005',
    category: '实验室检验',
    name: '空腹血糖 + HbA1c',
    priority: 'required',
    indication: '患者血糖控制不佳，需监测血糖水平及近 3 月控制情况，指导降糖及用药方案。',
    sample: '空腹静脉血 2 ml',
    turnaround: 'HbA1c 约 2 小时',
    tags: ['血糖控制不佳', '糖尿病监测'],
  },
  {
    test_id: 'L006',
    category: '实验室检验',
    name: '肝功能（ALT / AST / ALP / GGT / TBIL）',
    priority: 'recommended',
    indication: '使用他汀类药物，需基线评估肝功能并监测药物不良反应（ALT > 3×ULN 时停药）。',
    sample: '静脉血 3 ml，空腹或非空腹均可',
    turnaround: '约 2 小时',
    tags: ['他汀监测', '药物安全'],
  },
  {
    test_id: 'L007',
    category: '实验室检验',
    name: '肾功能 + 电解质（Cr / BUN / K+ / Na+）',
    priority: 'required',
    indication: '使用 ACEI（培哚普利）后 2 周复查肾功能及血钾，防止高钾血症及急性肾损伤。',
    sample: '静脉血 3 ml',
    turnaround: '约 2 小时',
    tags: ['ACEI监测', '高钾风险'],
  },
  {
    test_id: 'L008',
    category: '实验室检验',
    name: '凝血功能（PT / APTT / INR）',
    priority: 'recommended',
    indication: '双联抗血小板治疗前评估基线凝血状态，出血高危患者术前参考。',
    sample: '静脉血 2 ml，蓝盖枸橼酸钠管',
    turnaround: '约 1.5 小时',
    tags: ['抗血小板', '出血评估'],
  },
  // ── 影像检查 ──
  {
    test_id: 'I001',
    category: '影像检查',
    name: '心脏彩超（超声心动图）',
    priority: 'required',
    indication: '评估左室射血分数（LVEF）、室壁运动异常、瓣膜功能及心包积液，为危险分层提供结构依据。',
    sample: '无需空腹，检查约 20 分钟',
    turnaround: '当日出报告',
    tags: ['左室功能', 'LVEF评估'],
  },
  {
    test_id: 'I002',
    category: '影像检查',
    name: '冠状动脉 CTA（CCTA）',
    priority: 'recommended',
    indication: '无创评估冠脉狭窄程度及斑块性质，中低危患者优先于有创造影，排除显著冠脉病变。',
    sample: '需预约，心率控制 < 60 次/分，碘对比剂过敏者禁忌',
    turnaround: '检查后 24 小时报告',
    tags: ['冠脉评估', '中低危患者'],
  },
  {
    test_id: 'I003',
    category: '影像检查',
    name: '胸部 X 线（正位）',
    priority: 'required',
    indication: '评估心影大小、肺淤血、胸腔积液及肺部感染，辅助排除非心源性胸痛原因。',
    sample: '无需准备，立位或卧位均可',
    turnaround: '约 30 分钟',
    tags: ['胸痛鉴别', '肺淤血'],
  },
  // ── 功能检查 ──
  {
    test_id: 'F001',
    category: '功能检查',
    name: '12 导联心电图（静息 ECG）',
    priority: 'required',
    indication: '胸痛发作时及间歇期均需记录，识别 ST 段改变、T 波异常、传导阻滞，动态比较是关键。',
    sample: '静息状态，去除金属物品',
    turnaround: '即时出结果',
    tags: ['ST段监测', '动态比较'],
  },
  {
    test_id: 'F002',
    category: '功能检查',
    name: '24 小时动态心电图（Holter）',
    priority: 'recommended',
    indication: '捕捉一过性 ST 段压低、心律失常（如室性早搏、短阵室速），识别无症状心肌缺血事件。',
    sample: '佩戴监测仪 24 小时，正常活动',
    turnaround: '24 小时后分析报告',
    tags: ['动态监测', '心律失常'],
  },
  {
    test_id: 'F003',
    category: '功能检查',
    name: '运动负荷试验（平板运动试验）',
    priority: 'optional',
    indication: '血流动力学稳定、静息 ECG 无明显 ST 改变时，评估运动诱发缺血及功能储备。',
    sample: '禁止急性期、禁止心衰失代偿期，需医生陪同',
    turnaround: '当日完成',
    tags: ['运动诱发缺血', '稳定期评估'],
  },
]

// ── 工具 ─────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TestPriority, { label: string; color: string; bg: string; border: string }> = {
  required:    { label: '必做',  color: '#c0392b', bg: '#fdedec', border: '#f1948a' },
  recommended: { label: '推荐',  color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  optional:    { label: '可选',  color: '#5d8a9e', bg: '#eaf4fd', border: '#aed6f1' },
}

const STATUS_CONFIG: Record<ResultStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: '待开单',  color: '#8a9fb4', bg: '#f0f7fc' },
  ordered:   { label: '已开单',  color: '#2980b9', bg: '#eaf4fd' },
  completed: { label: '已完成',  color: '#27ae60', bg: '#eafaf1' },
  abnormal:  { label: '结果异常', color: '#c0392b', bg: '#fdedec' },
}

const CATEGORY_ICONS: Record<TestCategory, string> = {
  '实验室检验': '🔬',
  '影像检查':   '🖼',
  '功能检查':   '📈',
}

// ── 摘要生成 ──────────────────────────────────────────

function buildSummary(
  selectedIds: string[],
  statusMap: Record<string, string>,
  diagnosis: string,
  patientName: string,
  visitId: string,
): string {
  const selected = MOCK_TESTS.filter(t => selectedIds.includes(t.test_id))
  if (selected.length === 0) return '（未选择任何检验检查项目）'

  const byCategory = selected.reduce<Record<string, TestItem[]>>((acc, t) => {
    acc[t.category] = acc[t.category] ?? []
    acc[t.category].push(t)
    return acc
  }, {})

  const lines: string[] = [
    '【检验检查推荐清单】',
    `患者：${patientName || '—'}   就诊号：${visitId || '—'}`,
    `诊断：${diagnosis || '（待确认）'}`,
    `共推荐 ${selected.length} 项（必做 ${selected.filter(t => t.priority === 'required').length} 项，推荐 ${selected.filter(t => t.priority === 'recommended').length} 项，可选 ${selected.filter(t => t.priority === 'optional').length} 项）`,
    '',
  ]

  Object.entries(byCategory).forEach(([cat, tests]) => {
    lines.push(`【${cat}】`)
    tests.forEach((t, i) => {
      const status = statusMap[t.test_id]
      const statusLabel = status ? `（${STATUS_CONFIG[status as ResultStatus]?.label ?? status}）` : ''
      lines.push(`${i + 1}. [${PRIORITY_CONFIG[t.priority].label}] ${t.name}${statusLabel}`)
      lines.push(`   适应：${t.indication}`)
      lines.push(`   采样：${t.sample}`)
      lines.push(`   报告：${t.turnaround}`)
    })
    lines.push('')
  })

  lines.push(`生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`)
  return lines.join('\n')
}

// ── 主组件 ────────────────────────────────────────────

export default function TestsPage() {
  const {
    selectedTests, toggleTest, selectAllRequired, clearAllTests,
    testResultStatuses, setTestResultStatus,
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal,
  } = useAppStore()

  const [expandedTest, setExpandedTest]         = useState<string | null>(null)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [summaryOpen, setSummaryOpen]           = useState(false)
  const [copied, setCopied]                     = useState(false)

  // 按类别分组
  const categories = useMemo(() => {
    const groups: Record<TestCategory, TestItem[]> = {
      '实验室检验': [],
      '影像检查': [],
      '功能检查': [],
    }
    MOCK_TESTS.forEach(t => groups[t.category].push(t))
    return groups
  }, [])

  const requiredIds = useMemo(() => MOCK_TESTS.filter(t => t.priority === 'required').map(t => t.test_id), [])
  const selectedItems = useMemo(() => MOCK_TESTS.filter(t => selectedTests.includes(t.test_id)), [selectedTests])

  const summary = useMemo(() => buildSummary(
    selectedTests,
    testResultStatuses,
    selectedDiagnosis,
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
  ), [selectedTests, testResultStatuses, selectedDiagnosis, patientContext])

  const handleSelectAllRequired = () => {
    selectAllRequired(requiredIds)
    showToast(`已全选 ${requiredIds.length} 项必做检查`, 'success')
  }

  const handleClearAll = () => {
    clearAllTests()
    setSummaryGenerated(false)
    setSummaryOpen(false)
    showToast('已清空全部选择', 'info')
  }

  const handleGenerateSummary = () => {
    if (selectedTests.length === 0) {
      showToast('请先选择至少一项检验检查', 'error')
      return
    }
    setSummaryGenerated(true)
    setSummaryOpen(true)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      showToast('推荐清单已复制到剪贴板', 'info')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  return (
    <div className="page te-page">

      {/* ── 页头 ── */}
      <div className="te-header">
        <div className="te-header-left">
          <span className="te-page-icon">◎</span>
          <div>
            <div className="te-page-title">检验检查推荐</div>
            <div className="te-page-sub">
              基于诊断与用药方案智能推荐 · {MOCK_TESTS.length} 项可选 · 已选 {selectedTests.length} 项
            </div>
          </div>
        </div>
        <div className="te-bulk-actions">
          <button className="te-btn-select-required" onClick={handleSelectAllRequired}>
            全选必做
          </button>
          <button className="te-btn-clear" onClick={handleClearAll}>
            清空全部
          </button>
        </div>
      </div>

      {/* ── 诊断上下文条 ── */}
      {selectedDiagnosis && (
        <div className="te-context-strip">
          <span className="te-ctx-label">推荐依据</span>
          <span className="te-ctx-dx">⚕ {selectedDiagnosis}</span>
          <span className="te-ctx-hint">以下项目基于当前诊断及治疗方案自动匹配</span>
        </div>
      )}

      {/* ── 主体滚动区 ── */}
      <div className="te-body">

        {/* ── 推荐列表（按类别分组）── */}
        {(Object.entries(categories) as [TestCategory, TestItem[]][]).map(([cat, tests]) => (
          <div key={cat} className="te-section">
            <div className="te-sec-title">
              <span className="te-cat-icon">{CATEGORY_ICONS[cat]}</span>
              {cat}
              <span className="te-count-badge">
                {tests.filter(t => selectedTests.includes(t.test_id)).length} / {tests.length} 已选
              </span>
            </div>

            <div className="te-test-list">
              {tests.map(test => {
                const isSelected  = selectedTests.includes(test.test_id)
                const isExpanded  = expandedTest === test.test_id
                const pCfg        = PRIORITY_CONFIG[test.priority]
                const status      = (testResultStatuses[test.test_id] ?? 'pending') as ResultStatus
                const sCfg        = STATUS_CONFIG[status]

                return (
                  <div
                    key={test.test_id}
                    className={`te-test-row ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                  >
                    {/* 主行 */}
                    <div className="te-test-main">
                      <input
                        type="checkbox"
                        className="te-checkbox"
                        checked={isSelected}
                        onChange={() => toggleTest(test.test_id)}
                      />

                      <span
                        className="te-priority-badge"
                        style={{ color: pCfg.color, background: pCfg.bg, borderColor: pCfg.border }}
                      >
                        {pCfg.label}
                      </span>

                      <div className="te-test-info" onClick={() => setExpandedTest(isExpanded ? null : test.test_id)}>
                        <span className="te-test-name">{test.name}</span>
                        <span className="te-test-sample-hint">{test.sample}</span>
                      </div>

                      {/* 结果状态 */}
                      {isSelected && (
                        <select
                          className="te-status-select"
                          value={status}
                          style={{ color: sCfg.color, background: sCfg.bg }}
                          onChange={e => setTestResultStatus(test.test_id, e.target.value)}
                        >
                          <option value="pending">待开单</option>
                          <option value="ordered">已开单</option>
                          <option value="completed">已完成</option>
                          <option value="abnormal">结果异常</option>
                        </select>
                      )}

                      <span
                        className={`te-expand-chevron ${isExpanded ? 'open' : ''}`}
                        onClick={() => setExpandedTest(isExpanded ? null : test.test_id)}
                      >›</span>
                    </div>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="te-test-detail">
                        <div className="te-detail-row">
                          <span className="te-detail-label">推荐理由</span>
                          <span className="te-detail-val">{test.indication}</span>
                        </div>
                        <div className="te-detail-row">
                          <span className="te-detail-label">采样说明</span>
                          <span className="te-detail-val">{test.sample}</span>
                        </div>
                        <div className="te-detail-row">
                          <span className="te-detail-label">报告时间</span>
                          <span className="te-detail-val">{test.turnaround}</span>
                        </div>
                        <div className="te-detail-tags">
                          {test.tags.map(tag => (
                            <span key={tag} className="te-tag">{tag}</span>
                          ))}
                        </div>
                        {status === 'abnormal' && (
                          <div className="te-abnormal-hint">
                            ⚠ 结果异常 — 请结合临床判断，必要时回顾诊断或调整治疗方案
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* ── 当前推荐清单 ── */}
        <div className="te-section te-selected-section">
          <div className="te-sec-title">
            当前推荐清单
            <span className="te-count-badge">{selectedItems.length} 项</span>
            {selectedItems.some(t => testResultStatuses[t.test_id] === 'abnormal') && (
              <span className="te-abnormal-badge">含异常结果</span>
            )}
          </div>

          {selectedItems.length === 0 ? (
            <div className="te-empty-hint">暂未选择任何检验检查项目，请在上方勾选</div>
          ) : (
            <div className="te-selected-list">
              {selectedItems.map(t => {
                const pCfg  = PRIORITY_CONFIG[t.priority]
                const status = (testResultStatuses[t.test_id] ?? 'pending') as ResultStatus
                const sCfg  = STATUS_CONFIG[status]
                return (
                  <div key={t.test_id} className="te-selected-row">
                    <span className="te-sel-priority" style={{ color: pCfg.color }}>{pCfg.label}</span>
                    <span className="te-sel-name">{t.name}</span>
                    <span className="te-sel-cat">{t.category}</span>
                    <span
                      className="te-sel-status"
                      style={{ color: sCfg.color, background: sCfg.bg }}
                    >{sCfg.label}</span>
                    {status === 'abnormal' && (
                      <span className="te-sel-abnormal-dot" title="结果异常，建议复核">⚠</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 推荐摘要 ── */}
        <div className="te-section te-summary-section">
          <div className="te-summary-header">
            <div className="te-sec-title" style={{ margin: 0 }}>推荐清单摘要</div>
            {!summaryGenerated ? (
              <button className="te-btn-generate" onClick={handleGenerateSummary}>
                一键生成摘要
              </button>
            ) : (
              <button
                className="te-btn-toggle"
                onClick={() => setSummaryOpen(v => !v)}
              >{summaryOpen ? '收起' : '展开'}</button>
            )}
          </div>

          {summaryGenerated && summaryOpen && (
            <>
              <pre className="te-summary-text">{summary}</pre>
              <div className="te-summary-actions">
                <button className="te-btn-copy" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '复制清单'}
                </button>
                <button className="te-btn-writeback" onClick={openWritebackModal}>
                  回写 HIS
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── 异常结果提示区（仅当有异常时显示）── */}
        {Object.values(testResultStatuses).some(s => s === 'abnormal') && (
          <div className="te-section te-abnormal-section">
            <div className="te-sec-title">
              <span style={{ color: '#c0392b' }}>⚠ 异常结果 — 诊断决策支撑</span>
            </div>
            <div className="te-abnormal-list">
              {selectedItems
                .filter(t => testResultStatuses[t.test_id] === 'abnormal')
                .map(t => (
                  <div key={t.test_id} className="te-abnormal-row">
                    <span className="te-abn-name">{t.name}</span>
                    <span className="te-abn-hint">结果异常，建议回顾辅助诊断页签，结合检验结果更新诊断推断</span>
                    <span className="te-abn-link">→ 辅助诊断</span>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
