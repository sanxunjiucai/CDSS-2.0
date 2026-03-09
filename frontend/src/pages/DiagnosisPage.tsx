import { useState, useMemo } from 'react'
import { useAppStore } from '../store'
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

// ── Mock 数据 ─────────────────────────────────────────

const MOCK_DIAGNOSES: DiagnosisItem[] = [
  {
    id: 'd1',
    disease_name: '冠心病 — 不稳定型心绞痛',
    icd_code: 'I20.0',
    confidence: 0.88,
    priority: 1,
    match_label: '高度匹配',
    reasoning: '胸闷、气短、心悸三联症状，活动后加重且休息可缓解，高度符合缺血性心脏病典型表现；叠加高血压 + 糖尿病双重危险因素。',
    evidence: [
      { text: '胸闷（主诉）',            type: 'symptom', weight: 'strong'     },
      { text: '气短（主诉）',            type: 'symptom', weight: 'strong'     },
      { text: '心悸（主诉）',            type: 'symptom', weight: 'strong'     },
      { text: '活动后加重，休息缓解（现病史）', type: 'pattern', weight: 'strong' },
      { text: '高血压 10 年（既往史）',  type: 'history', weight: 'moderate'   },
      { text: '糖尿病 5 年（既往史）',   type: 'history', weight: 'moderate'   },
      { text: '心血管高危（风险标签）',  type: 'risk',    weight: 'supportive' },
    ],
    differential: [
      { disease: '急性心肌梗死',   relationship: 'exclude',  note: '需肌钙蛋白 + 心电图鉴别；症状若持续 > 20 分钟需排除' },
      { disease: '心律失常-房颤',  relationship: 'consider', note: '心悸症状需心电图评估是否合并房颤' },
      { disease: '心力衰竭',       relationship: 'consider', note: '乏力 + 气短可合并存在，BNP 有助鉴别' },
      { disease: '焦虑/躯体化障碍', relationship: 'monitor', note: '心悸症状需排除心理因素，心电图正常时考虑' },
    ],
    tags: ['首选诊断', '需立即处理'],
  },
  {
    id: 'd2',
    disease_name: '心律失常 — 阵发性房颤',
    icd_code: 'I48.0',
    confidence: 0.72,
    priority: 2,
    match_label: '中度匹配',
    reasoning: '心悸症状显著，叠加心血管基础病史，需心电图评估是否存在阵发性房颤。活动后心悸加重亦符合房颤特征。',
    evidence: [
      { text: '心悸（主诉）',           type: 'symptom', weight: 'strong'     },
      { text: '乏力（现病史）',         type: 'symptom', weight: 'moderate'   },
      { text: '高血压 10 年（既往史）', type: 'history', weight: 'supportive' },
      { text: '糖尿病 5 年（既往史）',  type: 'history', weight: 'supportive' },
    ],
    differential: [
      { disease: '室上性心动过速（SVT）', relationship: 'exclude',  note: '突发突止的心悸需排查 SVT，Holter 有助鉴别' },
      { disease: '甲状腺功能亢进',        relationship: 'consider', note: '心悸 + 乏力需检测甲状腺功能' },
    ],
    tags: ['需排查', '需心电图'],
  },
  {
    id: 'd3',
    disease_name: '慢性心力衰竭（代偿期）',
    icd_code: 'I50.9',
    confidence: 0.61,
    priority: 3,
    match_label: '低度匹配',
    reasoning: '气短 + 乏力持续存在，且患者具有高血压和糖代谢异常双重危险因素，需排查是否存在早期心功能不全。',
    evidence: [
      { text: '气短（主诉）',            type: 'symptom', weight: 'moderate'   },
      { text: '乏力（现病史）',          type: 'symptom', weight: 'moderate'   },
      { text: '活动耐量下降（现病史）',  type: 'pattern', weight: 'supportive' },
      { text: '高血压 10 年（既往史）',  type: 'history', weight: 'supportive' },
    ],
    differential: [
      { disease: '肺源性气短（COPD）', relationship: 'exclude',  note: '无吸烟史，但气短需肺功能排查' },
      { disease: '贫血',               relationship: 'consider', note: '乏力气短需查血常规排除贫血' },
    ],
    tags: ['需进一步检查'],
  },
]

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

export default function DiagnosisPage() {
  const { selectedDiagnosis, setSelectedDiagnosis, parsedEntities, showToast, openWritebackModal } = useAppStore()

  const [expandedId, setExpandedId]   = useState<string | null>('d1')
  const [activeTab, setActiveTab]     = useState<Record<string, DetailTab>>({})
  const [sortKey, setSortKey]         = useState<SortKey>('confidence')

  // 来自解析的已确认实体，作为来源摘要
  const confirmedEntities = parsedEntities.filter(e => e.confirmed)

  const sorted = useMemo(() => {
    return [...MOCK_DIAGNOSES].sort((a, b) =>
      sortKey === 'confidence' ? b.confidence - a.confidence : a.priority - b.priority
    )
  }, [sortKey])

  const getTab = (id: string): DetailTab => activeTab[id] ?? 'evidence'
  const setTab = (id: string, tab: DetailTab) => setActiveTab(prev => ({ ...prev, [id]: tab }))

  const handleAdopt = (item: DiagnosisItem) => {
    setSelectedDiagnosis(item.disease_name)
    showToast(`已采纳诊断：${item.disease_name}`, 'success')
    setExpandedId(item.id)
  }

  return (
    <div className="page dx-page">

      {/* ── 页头 ── */}
      <div className="dx-header">
        <div className="dx-header-left">
          <span className="dx-page-icon">⚕</span>
          <div>
            <div className="dx-page-title">辅助诊断</div>
            <div className="dx-page-sub">基于患者信息智能推荐 · {MOCK_DIAGNOSES.length} 条结果</div>
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
