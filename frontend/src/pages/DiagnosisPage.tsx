import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store'
import { fetchDiagnoses } from '../api/endpoints'
import './common.css'
import './DiagnosisPage.css'

// ── 本地类型 ─────────────────────────────────────────

type EvidenceWeight = 'strong' | 'moderate' | 'supportive'
type EvidenceType   = 'symptom' | 'sign' | 'history' | 'pattern' | 'risk'
type DifferentialRel = 'exclude' | 'consider' | 'monitor'
type SortKey = 'confidence' | 'priority'
type DetailTab = 'evidence' | 'differential'

interface DiagnosisEvidence {
  text: string
  type: EvidenceType
  weight: EvidenceWeight
}

interface DifferentialItem {
  disease: string
  relationship: DifferentialRel
  note: string
}

interface DiagnosisItem {
  id: string
  disease_name: string
  icd_code: string
  confidence: number
  priority: number
  match_label: '高度匹配' | '中度匹配' | '低度匹配'
  reasoning: string
  evidence: DiagnosisEvidence[]
  differential: DifferentialItem[]
  tags: string[]
}

// ── 辅助工具 ──────────────────────────────────────────

const WEIGHT_CONFIG: Record<EvidenceWeight, { label: string; color: string }> = {
  strong:     { label: '强支持',   color: '#27ae60' },
  moderate:   { label: '支持',     color: '#2980b9' },
  supportive: { label: '参考',     color: '#95a5b4' },
}

const TYPE_ICON: Record<EvidenceType, string> = {
  symptom: '◉', sign: '△', history: '◷', pattern: '⤷', risk: '⚑',
}

const DIFF_CONFIG: Record<DifferentialRel, { label: string; color: string; bg: string }> = {
  exclude:  { label: '需排除', color: '#c0392b', bg: '#fdedec' },
  consider: { label: '需考虑', color: '#d68910', bg: '#fef9ec' },
  monitor:  { label: '需监测', color: '#6c7a89', bg: '#f4f6f7' },
}

const MATCH_COLOR: Record<DiagnosisItem['match_label'], string> = {
  '高度匹配': '#1a6fa8',
  '中度匹配': '#d68910',
  '低度匹配': '#7f8c8d',
}

function confidenceColor(v: number) {
  if (v >= 0.85) return '#1a6fa8'
  if (v >= 0.65) return '#d68910'
  return '#7f8c8d'
}

// ── 主组件 ────────────────────────────────────────────

function matchLabel(confidence: number): DiagnosisItem['match_label'] {
  if (confidence >= 0.85) return '高度匹配'
  if (confidence >= 0.65) return '中度匹配'
  return '低度匹配'
}

export default function DiagnosisPage() {
  const { selectedDiagnosis, setSelectedDiagnosis, parsedEntities, showToast, openWritebackModal } = useAppStore()

  const [diagnoses, setDiagnoses]     = useState<DiagnosisItem[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [activeTab, setActiveTab]     = useState<Record<string, DetailTab>>({})
  const [sortKey, setSortKey]         = useState<SortKey>('confidence')

  // 来自解析的已确认实体，作为来源摘要
  const confirmedEntities = parsedEntities.filter(e => e.status === 'accepted')

  const loadDiagnoses = (entities: typeof parsedEntities) => {
    setLoading(true)
    setError(null)
    fetchDiagnoses(entities)
      .then(results => {
        const items: DiagnosisItem[] = results.map((r, i) => ({
          id: `d${i + 1}`,
          disease_name: r.disease_name,
          icd_code: r.icd_code,
          confidence: r.confidence,
          priority: r.priority,
          match_label: matchLabel(r.confidence),
          reasoning: r.reasoning,
          evidence: [],
          differential: [],
          tags: r.tags,
        }))
        setDiagnoses(items)
        if (items.length > 0) setExpandedId(items[0].id)
      })
      .catch(err => {
        console.error('fetchDiagnoses failed', err)
        const msg = err instanceof Error ? err.message : '诊断推荐失败'
        setError(msg)
        showToast('诊断推荐失败，请检查后端连接后重试', 'error')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const acceptedEntities = parsedEntities.filter(e => e.status === 'accepted')
    if (acceptedEntities.length === 0) return
    loadDiagnoses(acceptedEntities)
  }, [parsedEntities]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    return [...diagnoses].sort((a, b) =>
      sortKey === 'confidence' ? b.confidence - a.confidence : a.priority - b.priority
    )
  }, [diagnoses, sortKey])

  const getTab = (id: string): DetailTab => activeTab[id] ?? 'evidence'
  const setTab = (id: string, tab: DetailTab) => setActiveTab(prev => ({ ...prev, [id]: tab }))

  const handleAdopt = (item: DiagnosisItem) => {
    setSelectedDiagnosis(item.disease_name)
    showToast(`已采纳诊断：${item.disease_name}`, 'success')
    setExpandedId(item.id)
  }

  if (loading) return <div className="page dx-page"><p style={{ padding: 24, color: '#888' }}>正在推荐诊断…</p></div>

  if (error) {
    const acceptedEntities = parsedEntities.filter(e => e.status === 'accepted')
    return (
      <div className="page dx-page">
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ color: '#c0392b', fontSize: 14, marginBottom: 8 }}>⚠ 诊断推荐失败</p>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>{error}</p>
          <button
            style={{ padding: '7px 20px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}
            onClick={() => loadDiagnoses(acceptedEntities)}
          >重试</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page dx-page">

      {/* ── 页头 ── */}
      <div className="dx-header">
        <div className="dx-header-left">
          <span className="dx-page-icon">⚕</span>
          <div>
            <div className="dx-page-title">辅助诊断</div>
            <div className="dx-page-sub">基于患者信息智能推荐 · {diagnoses.length} 条结果</div>
          </div>
        </div>
        <div className="dx-header-right">
          <span className="dx-sort-label">排序：</span>
          <div className="dx-sort-tabs">
            <button
              className={`dx-sort-btn ${sortKey === 'confidence' ? 'active' : ''}`}
              onClick={() => setSortKey('confidence')}
            >可信度</button>
            <button
              className={`dx-sort-btn ${sortKey === 'priority' ? 'active' : ''}`}
              onClick={() => setSortKey('priority')}
            >优先级</button>
          </div>
        </div>
      </div>

      {/* ── 依据来源摘要条 ── */}
      {confirmedEntities.length > 0 && (
        <div className="dx-evidence-strip">
          <span className="dx-strip-label">推荐依据</span>
          {confirmedEntities.slice(0, 6).map(e => (
            <span key={e.id} className="dx-strip-chip">{e.text}</span>
          ))}
          {confirmedEntities.length > 6 && (
            <span className="dx-strip-more">+{confirmedEntities.length - 6}</span>
          )}
        </div>
      )}

      {/* ── 推荐卡片列表 ── */}
      <div className="dx-list">
        {sorted.map((item, idx) => {
          const isExpanded = expandedId === item.id
          const isAdopted  = selectedDiagnosis === item.disease_name
          const tab        = getTab(item.id)
          const confColor  = confidenceColor(item.confidence)

          return (
            <div
              key={item.id}
              className={`dx-card ${isExpanded ? 'dx-card-open' : ''} ${isAdopted ? 'dx-card-adopted' : ''}`}
            >
              {/* 卡片主行 */}
              <div className="dx-card-main" onClick={() => setExpandedId(isExpanded ? null : item.id)}>

                {/* 序号 + 已采纳标记 */}
                <div className="dx-rank" style={{ background: isAdopted ? '#27ae60' : confColor }}>
                  {isAdopted ? '✓' : idx + 1}
                </div>

                {/* 中心信息 */}
                <div className="dx-card-center">
                  <div className="dx-card-title-row">
                    <span className="dx-disease-name">{item.disease_name}</span>
                    <span className="dx-icd">{item.icd_code}</span>
                    {isAdopted && <span className="dx-adopted-badge">已采纳</span>}
                  </div>
                  <div className="dx-card-tags">
                    <span className="dx-match-badge" style={{ color: MATCH_COLOR[item.match_label] }}>
                      {item.match_label}
                    </span>
                    {item.tags.map(tag => (
                      <span key={tag} className="dx-tag">{tag}</span>
                    ))}
                  </div>
                  <p className="dx-reasoning">{item.reasoning}</p>
                </div>

                {/* 置信度 */}
                <div className="dx-conf-col">
                  <div className="dx-conf-value" style={{ color: confColor }}>
                    {(item.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="dx-conf-label">置信度</div>
                  <div className="dx-conf-bar-bg">
                    <div
                      className="dx-conf-bar-fill"
                      style={{ width: `${item.confidence * 100}%`, background: confColor }}
                    />
                  </div>
                </div>

                {/* 展开箭头 */}
                <div className={`dx-chevron ${isExpanded ? 'open' : ''}`}>›</div>
              </div>

              {/* 展开区：依据 + 鉴别诊断 */}
              {isExpanded && (
                <div className="dx-detail">
                  {/* 标签页切换 */}
                  <div className="dx-detail-tabs">
                    <button
                      className={`dx-dtab ${tab === 'evidence' ? 'active' : ''}`}
                      onClick={() => setTab(item.id, 'evidence')}
                    >推荐依据 ({item.evidence.length})</button>
                    <button
                      className={`dx-dtab ${tab === 'differential' ? 'active' : ''}`}
                      onClick={() => setTab(item.id, 'differential')}
                    >鉴别诊断 ({item.differential.length})</button>
                  </div>

                  {/* 推荐依据 */}
                  {tab === 'evidence' && (
                    <div className="dx-evidence-list">
                      {item.evidence.map((ev, i) => (
                        <div key={i} className="dx-ev-row">
                          <span className="dx-ev-type-icon">{TYPE_ICON[ev.type]}</span>
                          <span className="dx-ev-text">{ev.text}</span>
                          <span
                            className="dx-ev-weight"
                            style={{ color: WEIGHT_CONFIG[ev.weight].color }}
                          >{WEIGHT_CONFIG[ev.weight].label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 鉴别诊断 */}
                  {tab === 'differential' && (
                    <div className="dx-diff-list">
                      {item.differential.map((diff, i) => {
                        const cfg = DIFF_CONFIG[diff.relationship]
                        return (
                          <div key={i} className="dx-diff-row">
                            <span
                              className="dx-diff-badge"
                              style={{ color: cfg.color, background: cfg.bg }}
                            >{cfg.label}</span>
                            <span className="dx-diff-disease">{diff.disease}</span>
                            <span className="dx-diff-note">{diff.note}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 操作区 */}
                  <div className="dx-detail-actions">
                    {isAdopted ? (
                      <>
                        <span className="dx-adopted-label">✓ 已采纳此诊断</span>
                        <button
                          className="dx-btn-writeback"
                          onClick={() => openWritebackModal()}
                        >回写 HIS</button>
                      </>
                    ) : (
                      <button
                        className="dx-btn-adopt"
                        onClick={() => handleAdopt(item)}
                      >采纳此诊断</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
