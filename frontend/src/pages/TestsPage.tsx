import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store'
import { fetchRecommendedTests } from '../api/endpoints'
import './common.css'
import './TestsPage.css'

// ── 类型 ─────────────────────────────────────────────

type TestPriority = 'required' | 'recommended' | 'optional'
type TestCategory = '实验室检验' | '影像检查' | '功能检查'
type ResultStatus = 'pending' | 'ordered' | 'completed' | 'abnormal'

interface TestItemView {
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

const CAT_MAP: Record<string, TestCategory> = {
  '检验': '实验室检验',
  '影像': '影像检查',
  '检查': '功能检查',
}

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
  allTests: TestItemView[],
  selectedIds: string[],
  statusMap: Record<string, string>,
  diagnosis: string,
  patientName: string,
  visitId: string,
): string {
  const selected = allTests.filter(t => selectedIds.includes(t.test_id))
  if (selected.length === 0) return '（未选择任何检验检查项目）'

  const byCategory = selected.reduce<Record<string, TestItemView[]>>((acc, t) => {
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

  const [tests, setTests]                       = useState<TestItemView[]>([])
  const [loading, setLoading]                   = useState(false)
  const [expandedTest, setExpandedTest]         = useState<string | null>(null)
  const [summaryGenerated, setSummaryGenerated] = useState(false)
  const [summaryOpen, setSummaryOpen]           = useState(false)
  const [copied, setCopied]                     = useState(false)

  useEffect(() => {
    if (!selectedDiagnosis) return
    setLoading(true)
    fetchRecommendedTests(selectedDiagnosis)
      .then(results => {
        setTests(results.map(t => ({
          test_id: t.test_id,
          category: CAT_MAP[t.category] ?? '实验室检验',
          name: t.test_name,
          priority: t.priority,
          indication: t.reason,
          sample: t.sample_requirements,
          turnaround: '—',
          tags: [t.disease_name],
        })))
      })
      .catch(err => console.error('fetchRecommendedTests failed', err))
      .finally(() => setLoading(false))
  }, [selectedDiagnosis])

  // 按类别分组
  const categories = useMemo(() => {
    const groups: Record<TestCategory, TestItemView[]> = {
      '实验室检验': [],
      '影像检查': [],
      '功能检查': [],
    }
    tests.forEach(t => groups[t.category].push(t))
    return groups
  }, [tests])

  const requiredIds = useMemo(() => tests.filter(t => t.priority === 'required').map(t => t.test_id), [tests])
  const selectedItems = useMemo(() => tests.filter(t => selectedTests.includes(t.test_id)), [tests, selectedTests])

  const summary = useMemo(() => buildSummary(
    tests,
    selectedTests,
    testResultStatuses,
    selectedDiagnosis,
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
  ), [tests, selectedTests, testResultStatuses, selectedDiagnosis, patientContext])

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

  if (loading) return <div className="page te-page"><p style={{ padding: 24, color: '#888' }}>正在加载检验检查推荐…</p></div>

  return (
    <div className="page te-page">

      {/* ── 页头 ── */}
      <div className="te-header">
        <div className="te-header-left">
          <span className="te-page-icon">◎</span>
          <div>
            <div className="te-page-title">检验检查推荐</div>
            <div className="te-page-sub">
              基于诊断与用药方案智能推荐 · {tests.length} 项可选 · 已选 {selectedTests.length} 项
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
        {(Object.entries(categories) as [TestCategory, TestItemView[]][]).map(([cat, tests]) => (
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
