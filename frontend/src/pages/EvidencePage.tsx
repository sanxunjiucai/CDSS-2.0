import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAppStore } from '../store'
import { searchKnowledge, fetchSearchCategories } from '../api/endpoints'
import './common.css'
import './EvidencePage.css'


// ══════════════════════════════════════════════════════
// 类型
// ══════════════════════════════════════════════════════

type EvidenceType        = 'guideline' | 'meta' | 'rct' | 'cohort'
type RecommendationClass = 'I' | 'IIa' | 'IIb' | 'III'
type EvidenceLevel       = 'A' | 'B' | 'C'
type EvidenceTopic       = 'diagnosis' | 'treatment' | 'risk' | 'monitoring'
type FilterTopic         = 'all' | EvidenceTopic
type FilterType          = 'all' | EvidenceType
type SortMode            = 'relevance' | 'year' | 'grade'

interface EvidenceItem {
  id: string
  type: EvidenceType
  title: string
  source: string
  year: number
  topic: EvidenceTopic[]
  rec_class: RecommendationClass
  ev_level: EvidenceLevel
  key_finding: string
  summary: string
  detail: string
  population: string
  relevance_tags: string[]
  relevance_score: number
  target_step?: 'diagnosis' | 'personalized-treatment' | 'tests' | 'risk'
  target_label?: string
  citation: string
}

interface LinkageCard {
  step: 'diagnosis' | 'personalized-treatment' | 'tests' | 'risk'
  icon: string
  label: string
  desc: string
  count: number
  color: string
  bg: string
  border: string
}

// ══════════════════════════════════════════════════════
// API 类型映射
// ══════════════════════════════════════════════════════

const TYPE_MAP: Record<string, EvidenceType> = {
  '指南': 'guideline', '药物': 'rct', '疾病': 'cohort', '检验': 'meta',
}

const TOPIC_MAP: Record<string, EvidenceTopic[]> = {
  '指南': ['diagnosis', 'treatment'],
  '药物': ['treatment'],
  '疾病': ['diagnosis'],
  '检验': ['monitoring', 'risk'],
}

// ══════════════════════════════════════════════════════
// 静态联动卡片（无 API 等价物，保留静态数据）
// ══════════════════════════════════════════════════════

const LINKAGE_CARDS: LinkageCard[] = [
  {
    step: 'diagnosis',
    icon: '⚕',
    label: '辅助诊断',
    desc: 'ESC 0h/1h快速方案 + NSTEMI早期侵入性策略，支持NSTEMI诊断升级依据',
    count: 3,
    color: '#c0392b',
    bg: '#fdedec',
    border: '#f1948a',
  },
  {
    step: 'personalized-treatment',
    icon: '★',
    label: '个性化治疗',
    desc: 'PLATO替格瑞洛证据、糖尿病用药推荐、他汀强化方案、SGLT2抑制剂选择',
    count: 5,
    color: '#d68910',
    bg: '#fef9ec',
    border: '#f9d78e',
  },
  {
    step: 'tests',
    icon: '◎',
    label: '检验检查',
    desc: 'NT-proBNP升高支持加急行超声心动图，评估LVEF后决定治疗方案',
    count: 1,
    color: '#8e44ad',
    bg: '#f5eef8',
    border: '#d2b4de',
  },
  {
    step: 'risk',
    icon: '⚑',
    label: '风险审核',
    desc: 'PRECISE-DAPT评分指导DAPT疗程，GRACE评分支持高危分层',
    count: 2,
    color: '#2980b9',
    bg: '#eaf4fd',
    border: '#aed6f1',
  },
]

// ══════════════════════════════════════════════════════
// 工具配置
// ══════════════════════════════════════════════════════

const TYPE_CFG: Record<EvidenceType, { label: string; color: string; bg: string }> = {
  guideline: { label: '指南推荐', color: '#1a6fa8', bg: '#e8f4fd' },
  meta:      { label: 'Meta分析', color: '#6c3483', bg: '#f5eef8' },
  rct:       { label: 'RCT',     color: '#1e8449', bg: '#eafaf1' },
  cohort:    { label: '队列研究', color: '#d35400', bg: '#fef5ec' },
}

const CLASS_CFG: Record<RecommendationClass, { color: string; bg: string; desc: string }> = {
  I:   { color: '#145a32', bg: '#d5f5e3', desc: '强推荐' },
  IIa: { color: '#1a5276', bg: '#d6eaf8', desc: '较强推荐' },
  IIb: { color: '#784212', bg: '#fdebd0', desc: '弱推荐' },
  III: { color: '#78281f', bg: '#fadbd8', desc: '无益/有害' },
}

const TOPIC_TABS: { id: FilterTopic; label: string }[] = [
  { id: 'all',        label: '全部' },
  { id: 'diagnosis',  label: '诊断依据' },
  { id: 'treatment',  label: '治疗推荐' },
  { id: 'risk',       label: '风险评估' },
  { id: 'monitoring', label: '监测管理' },
]

const TYPE_FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all',       label: '全部类型' },
  { id: 'guideline', label: '指南' },
  { id: 'meta',      label: 'Meta' },
  { id: 'rct',       label: 'RCT' },
  { id: 'cohort',    label: '队列' },
]

// ── 证据摘要生成 ──────────────────────────────────────

function buildEvidenceSummary(
  evidence: EvidenceItem[],
  diagnosis: string,
  patient: { name?: string; visit_id?: string; age?: number } | null,
): string {
  const byTopic = (topic: EvidenceTopic) => evidence.filter(e => e.topic.includes(topic))
  const dxItems = byTopic('diagnosis')
  const txItems = byTopic('treatment')
  const riskItems = byTopic('risk')

  const fmt = (e: EvidenceItem) =>
    `• 【${e.source}，${e.year}】（Class ${e.rec_class}, Level ${e.ev_level}）\n  ${e.key_finding}`

  return [
    '【循证医学证据摘要】',
    `患者：${patient?.name ?? '—'}（${patient?.age ?? '—'}岁）   就诊号：${patient?.visit_id ?? '—'}`,
    `当前诊断：${diagnosis || '（待确认）'}`,
    `报告生成：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `共纳入相关证据 ${evidence.length} 条（指南 ${evidence.filter(e => e.type === 'guideline').length} 条，RCT ${evidence.filter(e => e.type === 'rct').length} 条，Meta分析 ${evidence.filter(e => e.type === 'meta').length} 条）`,
    '',
    '【诊断支持证据】',
    dxItems.length > 0 ? dxItems.map(fmt).join('\n') : '（无）',
    '',
    '【治疗推荐证据】',
    txItems.length > 0 ? txItems.map(fmt).join('\n') : '（无）',
    '',
    '【风险评估证据】',
    riskItems.length > 0 ? riskItems.map(fmt).join('\n') : '（无）',
    '',
    '【关键引用】',
    ...evidence.slice(0, 5).map((e, i) => `[${i + 1}] ${e.citation}`),
    '',
    '【声明】本摘要基于当前病例特征自动匹配生成，仅供临床参考，最终诊疗决策须由主管医师综合判断。',
  ].join('\n')
}

// ══════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════

export default function EvidencePage() {
  const {
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal, setCurrentStep,
  } = useAppStore()

  const [evidence,         setEvidence]         = useState<EvidenceItem[]>([])
  const [apiLoading,       setApiLoading]        = useState(false)
  const [filterTopic,      setFilterTopic]      = useState<FilterTopic>('all')
  const [filterType,       setFilterType]        = useState<FilterType>('all')
  const [sortMode,         setSortMode]          = useState<SortMode>('relevance')
  const [searchText,       setSearchText]        = useState('')
  const [drawerItem,       setDrawerItem]        = useState<EvidenceItem | null>(null)
  const [citedIds,         setCitedIds]          = useState<Set<string>>(new Set())
  const [summaryGenerated, setSummaryGenerated]  = useState(false)
  const [summaryOpen,      setSummaryOpen]       = useState(false)
  const [copied,           setCopied]            = useState(false)
  // API 搜索分类（来自 /api/search/categories）
  const [apiCategories,    setApiCategories]     = useState<string[]>(['全部'])
  const [apiCategory,      setApiCategory]       = useState<string>('全部')

  useEffect(() => {
    fetchSearchCategories()
      .then(cats => setApiCategories(['全部', ...cats.filter(c => c !== '全部')]))
      .catch(() => {/* 保持默认值 */})
  }, [])

  const loadEvidence = useCallback((keyword: string, category = apiCategory) => {
    if (!keyword.trim()) return
    setApiLoading(true)
    searchKnowledge(keyword, category)
      .then(results => {
        setEvidence(results.map((r, i) => {
          const evType: EvidenceType = TYPE_MAP[r.type] ?? 'guideline'
          const yearStr = r.updatedAt ? r.updatedAt.slice(0, 4) : '2024'
          return {
            id: r.id || `ev${i}`,
            type: evType,
            title: r.title,
            source: r.source,
            year: parseInt(yearStr, 10) || 2024,
            topic: TOPIC_MAP[r.type] ?? ['diagnosis'],
            rec_class: 'IIa' as RecommendationClass,
            ev_level: 'B' as EvidenceLevel,
            key_finding: r.summary.slice(0, 120),
            summary: r.summary,
            detail: r.content,
            population: '',
            relevance_tags: r.tags,
            relevance_score: 80,
            citation: r.source,
          }
        }))
      })
      .catch(err => console.error('searchKnowledge failed', err))
      .finally(() => setApiLoading(false))
  }, [])

  useEffect(() => {
    loadEvidence(selectedDiagnosis || '心绞痛')
  }, [selectedDiagnosis, loadEvidence])

  const filteredEvidence = useMemo(() => {
    let items = evidence
    if (filterTopic !== 'all') items = items.filter(e => e.topic.includes(filterTopic))
    if (filterType  !== 'all') items = items.filter(e => e.type === filterType)
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      items = items.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.key_finding.toLowerCase().includes(q) ||
        e.relevance_tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return [...items].sort((a, b) => {
      if (sortMode === 'relevance') return b.relevance_score - a.relevance_score
      if (sortMode === 'year')      return b.year - a.year
      const classOrder = { I: 0, IIa: 1, IIb: 2, III: 3 }
      const levelOrder = { A: 0, B: 1, C: 2 }
      const cmp = classOrder[a.rec_class] - classOrder[b.rec_class]
      return cmp !== 0 ? cmp : levelOrder[a.ev_level] - levelOrder[b.ev_level]
    })
  }, [evidence, filterTopic, filterType, sortMode, searchText])

  const summary = useMemo(() => buildEvidenceSummary(
    evidence,
    selectedDiagnosis,
    patientContext ? { name: patientContext.name, visit_id: patientContext.visit_id, age: patientContext.age } : null,
  ), [evidence, selectedDiagnosis, patientContext])

  const handleCite = (item: EvidenceItem) => {
    setCitedIds(prev => new Set([...prev, item.id]))
    showToast(`已引用「${item.title.slice(0, 18)}…」作为当前依据`, 'success')
  }

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      showToast('证据摘要已复制到剪贴板', 'info')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  const highRelevanceCount = evidence.filter(e => e.relevance_score >= 90).length
  const citedCount = citedIds.size

  if (apiLoading) return <div className="page ev-page"><p style={{ padding: 24, color: '#888' }}>正在检索循证证据…</p></div>

  return (
    <div className="page ev-page">

      {/* ════════════════ 页头 ════════════════ */}
      <div className="ev-header">
        <div className="ev-header-left">
          <span className="ev-page-icon">📚</span>
          <div>
            <div className="ev-page-title">循证医学</div>
            <div className="ev-page-sub">
              {evidence.length} 条相关证据 · {highRelevanceCount} 条高相关 · {citedCount > 0 ? `${citedCount} 条已引用` : ''}
            </div>
          </div>
        </div>
        <div className="ev-header-chips">
          {selectedDiagnosis && (
            <span className="ev-chip ev-chip-dx">⚕ {selectedDiagnosis}</span>
          )}
          {patientContext?.chronic_diseases?.map(d => (
            <span key={d} className="ev-chip ev-chip-tag">{d}</span>
          ))}
        </div>
      </div>

      {/* ════════════════ 搜索 + 筛选栏 ════════════════ */}
      <div className="ev-filter-area">
        {/* API 知识库分类筛选 */}
        {apiCategories.length > 1 && (
          <div className="ev-api-cat-row">
            {apiCategories.map(cat => (
              <button
                key={cat}
                className={`ev-api-cat-btn ${apiCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setApiCategory(cat)
                  loadEvidence(searchText || selectedDiagnosis || '心绞痛', cat)
                }}
              >{cat}</button>
            ))}
          </div>
        )}
        <div className="ev-search-row">
          <input
            className="ev-search-input"
            type="text"
            placeholder="搜索证据标题、关键发现、标签…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadEvidence(searchText || selectedDiagnosis || '心绞痛', apiCategory) }}
          />
          {searchText && (
            <button className="ev-search-clear" onClick={() => setSearchText('')}>✕</button>
          )}
        </div>
        <div className="ev-topic-tabs">
          {TOPIC_TABS.map(tab => (
            <button
              key={tab.id}
              className={`ev-topic-tab ${filterTopic === tab.id ? 'active' : ''}`}
              onClick={() => setFilterTopic(tab.id)}
            >{tab.label}</button>
          ))}
        </div>
        <div className="ev-type-sort-row">
          <div className="ev-type-chips">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.id}
                className={`ev-type-chip ${filterType === f.id ? 'active' : ''}`}
                onClick={() => setFilterType(f.id)}
              >{f.label}</button>
            ))}
          </div>
          <select
            className="ev-sort-select"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
          >
            <option value="relevance">按相关性</option>
            <option value="year">按年份</option>
            <option value="grade">按证据级别</option>
          </select>
        </div>
      </div>

      {/* ════════════════ 主体（可滚动）════════════════ */}
      <div className="ev-body">

        {/* ── 证据列表 ── */}
        <div className="ev-evidence-list">
          {filteredEvidence.length === 0 ? (
            <div className="ev-empty">未找到符合条件的证据</div>
          ) : filteredEvidence.map(item => {
            const tCfg  = TYPE_CFG[item.type]
            const cCfg  = CLASS_CFG[item.rec_class]
            const isCited = citedIds.has(item.id)

            return (
              <div
                key={item.id}
                className={`ev-card ${isCited ? 'cited' : ''}`}
              >
                <div className="ev-card-top">
                  <span
                    className="ev-grade-badge"
                    title={`Class ${item.rec_class}（${cCfg.desc}）/ Level ${item.ev_level}`}
                    style={{ color: cCfg.color, background: cCfg.bg }}
                  >
                    {item.rec_class} {item.ev_level}
                  </span>
                  <span className="ev-type-badge" style={{ color: tCfg.color, background: tCfg.bg }}>
                    {tCfg.label}
                  </span>
                  <span className="ev-year">{item.year}</span>
                  <span className="ev-relevance" title="与当前病例相关度">
                    相关 {item.relevance_score}%
                  </span>
                  {isCited && <span className="ev-cited-mark">✓ 已引用</span>}
                </div>

                <div className="ev-card-title">{item.title}</div>
                <div className="ev-card-source">{item.source}</div>
                <div className="ev-card-finding">{item.key_finding}</div>

                <div className="ev-card-tags">
                  {item.relevance_tags.slice(0, 4).map(t => (
                    <span key={t} className="ev-tag">{t}</span>
                  ))}
                </div>

                <div className="ev-card-actions">
                  <button
                    className="ev-btn-detail"
                    onClick={() => setDrawerItem(item)}
                  >查看详情</button>
                  {item.target_step && (
                    <button
                      className="ev-btn-goto"
                      onClick={() => setCurrentStep(item.target_step!)}
                    >{item.target_label} →</button>
                  )}
                  <button
                    className={`ev-btn-cite ${isCited ? 'cited' : ''}`}
                    onClick={() => handleCite(item)}
                    disabled={isCited}
                  >{isCited ? '✓ 已引用' : '引用为依据'}</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── 病例证据摘要 ── */}
        <div className="ev-section ev-summary-section">
          <div className="ev-summary-header">
            <div className="ev-sec-title" style={{ margin: 0 }}>
              病例证据摘要
              <span className="ev-sec-sub">整合面向当前病例的全部相关证据</span>
            </div>
            {!summaryGenerated ? (
              <button
                className="ev-btn-generate"
                onClick={() => { setSummaryGenerated(true); setSummaryOpen(true) }}
              >一键生成摘要</button>
            ) : (
              <button
                className="ev-btn-toggle"
                onClick={() => setSummaryOpen(v => !v)}
              >{summaryOpen ? '收起' : '展开'}</button>
            )}
          </div>
          {summaryGenerated && summaryOpen && (
            <>
              <pre className="ev-summary-text">{summary}</pre>
              <div className="ev-summary-actions">
                <button className="ev-btn-copy" onClick={handleCopySummary}>
                  {copied ? '✓ 已复制' : '复制摘要'}
                </button>
                <button className="ev-btn-writeback" onClick={openWritebackModal}>
                  回写 HIS
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── 页签联动 ── */}
        <div className="ev-section ev-linkage-section">
          <div className="ev-sec-title">循证内容输入其他模块</div>
          <div className="ev-linkage-grid">
            {LINKAGE_CARDS.map(card => (
              <div
                key={card.step}
                className="ev-linkage-card"
                style={{ background: card.bg, borderColor: card.border }}
                onClick={() => setCurrentStep(card.step)}
              >
                <div className="ev-link-header">
                  <span className="ev-link-icon">{card.icon}</span>
                  <span className="ev-link-label" style={{ color: card.color }}>{card.label}</span>
                  <span className="ev-link-count" style={{ color: card.color }}>{card.count} 条证据</span>
                </div>
                <div className="ev-link-desc">{card.desc}</div>
                <div className="ev-link-goto" style={{ color: card.color }}>点击关联 →</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 输出操作 ── */}
        <div className="ev-section ev-output-section">
          <div className="ev-output-row">
            <button
              className="ev-btn-save"
              onClick={() => showToast('参考记录已保存', 'success')}
            >保存参考记录</button>
            <button
              className="ev-btn-writeback2"
              onClick={openWritebackModal}
            >回写 HIS 预览</button>
          </div>
          {citedCount > 0 && (
            <div className="ev-cited-summary">
              ✓ 已引用 {citedCount} 条证据作为当前临床依据
            </div>
          )}
        </div>

      </div>

      {/* ════════════════ 证据详情抽屉 ════════════════ */}
      {drawerItem && (
        <div className="ev-drawer-mask" onClick={() => setDrawerItem(null)}>
          <div className="ev-drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="ev-drawer-header">
              <div className="ev-drawer-title-row">
                <span
                  className="ev-grade-badge"
                  style={{
                    color: CLASS_CFG[drawerItem.rec_class].color,
                    background: CLASS_CFG[drawerItem.rec_class].bg,
                  }}
                >
                  Class {drawerItem.rec_class} / Level {drawerItem.ev_level}
                </span>
                <span
                  className="ev-type-badge"
                  style={{
                    color: TYPE_CFG[drawerItem.type].color,
                    background: TYPE_CFG[drawerItem.type].bg,
                  }}
                >
                  {TYPE_CFG[drawerItem.type].label}
                </span>
              </div>
              <h3 className="ev-drawer-title">{drawerItem.title}</h3>
              <div className="ev-drawer-source">{drawerItem.source} · {drawerItem.year}</div>
              <button className="ev-drawer-close" onClick={() => setDrawerItem(null)}>✕</button>
            </div>

            <div className="ev-drawer-body">
              <div className="ev-drawer-block">
                <div className="ev-drawer-label">核心发现</div>
                <div className="ev-drawer-finding">{drawerItem.key_finding}</div>
              </div>

              <div className="ev-drawer-block">
                <div className="ev-drawer-label">摘要</div>
                <p className="ev-drawer-text">{drawerItem.summary}</p>
              </div>

              <div className="ev-drawer-block">
                <div className="ev-drawer-label">详细内容</div>
                <pre className="ev-drawer-detail">{drawerItem.detail}</pre>
              </div>

              <div className="ev-drawer-block">
                <div className="ev-drawer-label">适用人群</div>
                <p className="ev-drawer-text">{drawerItem.population}</p>
              </div>

              <div className="ev-drawer-block">
                <div className="ev-drawer-label">相关标签</div>
                <div className="ev-drawer-tags">
                  {drawerItem.relevance_tags.map(t => (
                    <span key={t} className="ev-tag">{t}</span>
                  ))}
                </div>
              </div>

              <div className="ev-drawer-block ev-drawer-citation">
                <div className="ev-drawer-label">引用格式</div>
                <p className="ev-drawer-cite-text">{drawerItem.citation}</p>
              </div>

              <div className="ev-drawer-actions">
                <button
                  className={`ev-btn-cite-drawer ${citedIds.has(drawerItem.id) ? 'cited' : ''}`}
                  onClick={() => handleCite(drawerItem)}
                  disabled={citedIds.has(drawerItem.id)}
                >
                  {citedIds.has(drawerItem.id) ? '✓ 已引用为依据' : '引用为当前依据'}
                </button>
                {drawerItem.target_step && (
                  <button
                    className="ev-btn-goto-drawer"
                    onClick={() => { setCurrentStep(drawerItem.target_step!); setDrawerItem(null) }}
                  >
                    {drawerItem.target_label} →
                  </button>
                )}
                <button className="ev-btn-close-drawer" onClick={() => setDrawerItem(null)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
