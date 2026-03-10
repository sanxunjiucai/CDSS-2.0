import { useEffect, useState, useMemo, useRef } from 'react'
import { useAppStore } from '../store'
import { ParsedEntity, EntityCategory, EntityStatus, PatientContext } from '../types'
import { parseInput } from '../api/endpoints'
import './common.css'
import './InputPage.css'

// ── ViewModel 层 ──────────────────────────────────────

type ClinicalGroupId = 'presentation' | 'history' | 'examination' | 'risk'

interface ClinicalGroupConfig {
  id: ClinicalGroupId
  label: string
  icon: string
  color: string
  categories: EntityCategory[]
}

interface ClinicalGroupView extends ClinicalGroupConfig {
  active: ParsedEntity[]
  excluded: ParsedEntity[]
}

const CLINICAL_GROUPS: ClinicalGroupConfig[] = [
  { id: 'presentation', label: '症状与体征',     icon: '◉', color: '#2980b9', categories: ['症状', '体征'] },
  { id: 'history',      label: '既往史与基础疾病', icon: '◷', color: '#c0392b', categories: ['疾病'] },
  { id: 'examination',  label: '检查与化验',      icon: '⊞', color: '#d35400', categories: ['检查'] },
  { id: 'risk',         label: '风险因素',        icon: '⚑', color: '#7d3c98', categories: ['风险'] },
]

function buildClinicalGroups(entities: ParsedEntity[]): ClinicalGroupView[] {
  return CLINICAL_GROUPS.map(cfg => {
    const all = entities.filter(e => cfg.categories.includes(e.category))
    return {
      ...cfg,
      active:   all.filter(e => e.status !== 'excluded'),
      excluded: all.filter(e => e.status === 'excluded'),
    }
  })
}

// ── 就绪判断 ──────────────────────────────────────────

interface MissingChip { text: string; category: EntityCategory }

interface Readiness {
  canProceed: boolean
  statusMessage: string           // 状态行文案
  suggestion: string | null       // 建议补充文案（null = 无需提示）
  suggestionChips: MissingChip[]  // 建议补充的快捷 chip
}

const SIGN_CHIPS: MissingChip[] = [
  { text: '血压',    category: '体征' },
  { text: '心率',    category: '体征' },
  { text: '血氧饱和度', category: '体征' },
  { text: '体温',    category: '体征' },
  { text: '呼吸频率', category: '体征' },
]

function computeReadiness(entities: ParsedEntity[]): Readiness {
  const accepted = entities.filter(e => e.status === 'accepted')

  if (accepted.length === 0) {
    return {
      canProceed: false,
      statusMessage: '请先保留至少一条临床信息后再进入诊断',
      suggestion: null,
      suggestionChips: [],
    }
  }

  const addedSignTexts = new Set(
    accepted.filter(e => e.category === '体征').map(e => e.text)
  )
  const remainingChips = SIGN_CHIPS.filter(c => !addedSignTexts.has(c.text))
  const missingSigns = remainingChips.length > 0 && addedSignTexts.size === 0

  return {
    canProceed: true,
    statusMessage: '当前信息已足够进入辅助诊断',
    suggestion: missingSigns ? '补充生命体征可提高建议准确性' : null,
    suggestionChips: missingSigns ? remainingChips.slice(0, 5) : [],
  }
}

// ── Area 1：来源说明条 ────────────────────────────────

function SourceSummaryBar({
  sources, onReparse, loading, canReparse,
}: {
  sources: string[]
  onReparse: () => void
  loading: boolean
  canReparse: boolean
}) {
  return (
    <div className="ip-source-bar">
      <span className="ip-source-bar-label">已分析患者文档：</span>
      <span className="ip-source-names">{sources.join(' · ') || '—'}</span>
      <button className="ip-reparse-btn" onClick={onReparse} disabled={loading || !canReparse}>
        {loading ? '解析中…' : '重新解析'}
      </button>
    </div>
  )
}

// ── Area 2：已采纳实体行 ──────────────────────────────

function ActiveEntityRow({
  entity, onExclude,
}: {
  entity: ParsedEntity
  onExclude: (id: string) => void
}) {
  const isAllergy = entity.text.includes('过敏')
  return (
    <div className="ip-active-row">
      <span className="ip-active-text">{entity.text}</span>
      {isAllergy && <span className="ip-allergy-badge">⚠ 过敏禁忌</span>}
      <span className="ip-active-source">{entity.source}</span>
      <button className="ip-exclude-btn" title="排除此项" onClick={() => onExclude(entity.id)}>
        ×
      </button>
    </div>
  )
}

// ── Area 2：单个临床分组卡片 ──────────────────────────
// 职责：展示已有信息 + 允许排除。不显示缺失提示。

function ClinicalGroupCard({
  group, onExclude, onUndo, onEmptyAdd,
}: {
  group: ClinicalGroupView
  onExclude: (id: string) => void
  onUndo: (id: string) => void
  onEmptyAdd: (category: EntityCategory) => void
}) {
  const [excludedOpen, setExcludedOpen] = useState(false)
  const isEmpty = group.active.length === 0 && group.excluded.length === 0

  return (
    <div className="ip-group-card">
      <div className="ip-group-header" style={{ borderLeftColor: group.color }}>
        <span className="ip-group-icon" style={{ color: group.color }}>{group.icon}</span>
        <span className="ip-group-label">{group.label}</span>
      </div>

      {group.active.length > 0 && (
        <div className="ip-active-list">
          {group.active.map(e => (
            <ActiveEntityRow key={e.id} entity={e} onExclude={onExclude} />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="ip-group-empty">
          未识别到{group.label}信息
          <button className="ip-group-add-btn" onClick={() => onEmptyAdd(group.categories[0])}>
            + 补录
          </button>
        </div>
      )}

      {group.excluded.length > 0 && (
        <div className="ip-excluded-section">
          <button className="ip-excluded-toggle" onClick={() => setExcludedOpen(v => !v)}>
            {group.excluded.length} 条未纳入 {excludedOpen ? '▴' : '▾'}
          </button>
          {excludedOpen && (
            <div className="ip-excluded-list">
              {group.excluded.map(e => (
                <div key={e.id} className="ip-excluded-row">
                  <span className="ip-excluded-text">{e.text}</span>
                  <button className="ip-undo-btn" onClick={() => onUndo(e.id)}>撤销</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Area 3：快速补录 ──────────────────────────────────

const CATEGORY_PILLS: { label: string; category: EntityCategory }[] = [
  { label: '症状表现',      category: '症状' },
  { label: '生命体征',      category: '体征' },
  { label: '既往史 / 用药', category: '疾病' },
  { label: '辅助检查',      category: '检查' },
  { label: '风险因素',      category: '风险' },
]

function QuickAddBar({
  focusCategory, onAdd,
}: {
  focusCategory: EntityCategory | null
  onAdd: (text: string, category: EntityCategory) => void
}) {
  const [text, setText] = useState('')
  const [cat, setCat]   = useState<EntityCategory>('症状')
  const inputRef        = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusCategory) {
      setCat(focusCategory)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [focusCategory])

  const handleAdd = () => {
    if (!text.trim()) return
    onAdd(text.trim(), cat)
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="ip-quickadd-bar">
      <div className="ip-quickadd-question">还有需要补充的信息吗？</div>
      <div className="ip-quickadd-pills">
        {CATEGORY_PILLS.map(p => (
          <button
            key={p.category}
            className={`ip-quickadd-pill ${cat === p.category ? 'active' : ''}`}
            onClick={() => { setCat(p.category); inputRef.current?.focus() }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="ip-quickadd-row">
        <input
          ref={inputRef}
          type="text"
          placeholder="例如：血压 145/90 mmHg、有吸烟史 30 年…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} disabled={!text.trim()}>添加</button>
      </div>
    </div>
  )
}

// ── Area 4：确认预览（含就绪判断 + 建议补充） ─────────

function ConfirmationPreview({
  clinicalGroups, readiness, onChipAdd, onConfirm,
}: {
  clinicalGroups: ClinicalGroupView[]
  readiness: Readiness
  onChipAdd: (chip: MissingChip) => void
  onConfirm: () => void
}) {
  const summary = clinicalGroups
    .map(g => ({ label: g.label, count: g.active.length }))
    .filter(g => g.count > 0)

  return (
    <div className="ip-confirm-preview">
      {/* 就绪状态行 */}
      <div className={`ip-readiness-row ${readiness.canProceed ? 'ok' : 'blocked'}`}>
        <span className="ip-readiness-icon">{readiness.canProceed ? '✓' : '○'}</span>
        <span className="ip-readiness-msg">{readiness.statusMessage}</span>
      </div>

      {/* 已接受信息摘要 */}
      {summary.length > 0 && (
        <div className="ip-confirm-groups">
          {summary.map((g, i) => (
            <span key={g.label}>
              {i > 0 && <span className="ip-confirm-sep">·</span>}
              <span className="ip-confirm-group-item">{g.label} {g.count} 项</span>
            </span>
          ))}
        </div>
      )}

      {summary.length > 0 && (
        <div className="ip-confirm-downstream">
          将用于 → 辅助诊断 · 量表评估 · 个性化治疗方案
        </div>
      )}

      {/* 建议补充区（非阻塞） */}
      {readiness.suggestion && (
        <div className="ip-suggestion-row">
          <span className="ip-suggestion-icon">💡</span>
          <span className="ip-suggestion-text">{readiness.suggestion}</span>
          <div className="ip-suggestion-chips">
            {readiness.suggestionChips.map(chip => (
              <button
                key={chip.text}
                className="ip-suggestion-chip"
                onClick={() => onChipAdd(chip)}
              >
                + {chip.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        className="ip-confirm-btn"
        onClick={onConfirm}
        disabled={!readiness.canProceed}
      >
        确认信息并进入辅助诊断
      </button>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────

export default function InputPage() {
  const {
    parsedEntities, setParsedEntities,
    setEntityStatus, addEntity,
    patientContext, setCurrentStep, showToast,
  } = useAppStore()

  const [loading, setLoading]             = useState(false)
  const [focusCategory, setFocusCategory] = useState<EntityCategory | null>(null)

  useEffect(() => {
    if (parsedEntities.length > 0 || !patientContext) return
    runParse(patientContext)
  }, [patientContext]) // eslint-disable-line react-hooks/exhaustive-deps

  function runParse(ctx: PatientContext) {
    setLoading(true)
    parseInput({
      chief_complaint: ctx.chief_complaint,
      present_illness: ctx.present_illness,
      past_history:    ctx.past_history,
    })
      .then(res => setParsedEntities(
        res.entities.map(e => ({ ...e, status: 'accepted' as EntityStatus }))
      ))
      .catch(() => showToast('解析失败，请重新尝试', 'error'))
      .finally(() => setLoading(false))
  }

  const handleReparse = () => {
    if (!patientContext) return
    setParsedEntities([])
    runParse(patientContext)
  }

  const makeEntity = (text: string, category: EntityCategory): ParsedEntity => ({
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text, category, source: '补充', status: 'accepted',
  })

  const handleAdd = (text: string, category: EntityCategory) => {
    addEntity(makeEntity(text, category))
    setFocusCategory(null)
  }

  const handleChipAdd = (chip: MissingChip) => {
    addEntity(makeEntity(chip.text, chip.category))
  }

  const handleConfirm = () => {
    if (!readiness.canProceed) { showToast('请先保留至少一条临床信息', 'error'); return }
    setCurrentStep('diagnosis')
  }

  const sources = useMemo(() => {
    const order = ['主诉', '现病史', '既往史', '补充']
    const present = new Set(
      parsedEntities.filter(e => e.status !== 'excluded').map(e => e.source)
    )
    return order.filter(s => present.has(s))
  }, [parsedEntities])

  const clinicalGroups = useMemo(
    () => buildClinicalGroups(parsedEntities),
    [parsedEntities]
  )

  const readiness = useMemo(
    () => computeReadiness(parsedEntities),
    [parsedEntities]
  )

  if (loading) {
    return <div className="page"><p className="ip-loading">正在解析 HIS 文本…</p></div>
  }

  return (
    <div className="page ip-page">
      <SourceSummaryBar
        sources={sources}
        onReparse={handleReparse}
        loading={loading}
        canReparse={!!patientContext}
      />

      <div className="ip-groups">
        {clinicalGroups.map(group => (
          <ClinicalGroupCard
            key={group.id}
            group={group}
            onExclude={id => setEntityStatus(id, 'excluded')}
            onUndo={id => setEntityStatus(id, 'accepted')}
            onEmptyAdd={cat => setFocusCategory(cat)}
          />
        ))}
      </div>

      <QuickAddBar focusCategory={focusCategory} onAdd={handleAdd} />

      <ConfirmationPreview
        clinicalGroups={clinicalGroups}
        readiness={readiness}
        onChipAdd={handleChipAdd}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
