import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store'
import { fetchRiskAssessment, fetchAuditAlerts } from '../api/endpoints'
import type { RiskScore as ApiRiskScore, AuditAlert as ApiAuditAlert } from '../api/endpoints'
import './common.css'
import './RiskPage.css'

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

type RiskLevel       = 'critical' | 'high' | 'moderate' | 'low'
type AlertLevel      = 'critical' | 'warning' | 'caution' | 'info'
type AlertCategory   = '药物安全' | '临床预警' | '合规审核' | '诊断一致性'
type SuggestionType  = 'exam' | 'diagnosis' | 'treatment' | 'consult' | 'monitor'

// ── 风险评分类型 ──────────────────────────────────────

interface ScoreModel {
  name: string
  score: number | string
  max?: number
  level: RiskLevel
  description: string
  factors: { name: string; value: string; contribution: 'high' | 'medium' | 'low' }[]
}

interface RiskAlert {
  id: string
  category: AlertCategory
  level: AlertLevel
  title: string
  detail: string
  related: string[]
  action: string
}

interface Suggestion {
  type: SuggestionType
  title: string
  content: string
  priority: 'urgent' | 'recommended' | 'optional'
}


// ══════════════════════════════════════════════════════
// 工具配置
// ══════════════════════════════════════════════════════

const RISK_LEVEL_CFG: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: '极高危', color: '#922b21', bg: '#fdedec', border: '#e74c3c' },
  high:     { label: '高危',   color: '#c0392b', bg: '#fdedec', border: '#f1948a' },
  moderate: { label: '中危',   color: '#d68910', bg: '#fef9ec', border: '#f9d78e' },
  low:      { label: '低危',   color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf' },
}

const ALERT_LEVEL_CFG: Record<AlertLevel, { icon: string; color: string; bg: string; border: string; label: string }> = {
  critical: { icon: '🚨', color: '#922b21', bg: '#fdedec', border: '#e74c3c', label: '严重' },
  warning:  { icon: '⚠',  color: '#c0392b', bg: '#fef2f0', border: '#f1948a', label: '警告' },
  caution:  { icon: '⚡',  color: '#d68910', bg: '#fef9ec', border: '#f9d78e', label: '注意' },
  info:     { icon: 'ℹ',  color: '#2980b9', bg: '#eaf4fd', border: '#aed6f1', label: '提示' },
}

const CATEGORY_ICONS: Record<AlertCategory, string> = {
  '药物安全':   '💊',
  '临床预警':   '⚑',
  '合规审核':   '📋',
  '诊断一致性': '⚕',
}

const ALERT_CATEGORIES: AlertCategory[] = ['药物安全', '临床预警', '合规审核', '诊断一致性']

// ══════════════════════════════════════════════════════
// 摘要生成
// ══════════════════════════════════════════════════════

function buildSummary(
  diagnosis: string,
  patientName: string,
  visitId: string,
  scoreModels: ScoreModel[],
  alerts: RiskAlert[],
): string {
  const riskLines = scoreModels.map(m =>
    `· ${m.name}：${m.score}${m.max ? '/' + m.max : ''} 分（${RISK_LEVEL_CFG[m.level].label}）`
  ).join('\n')

  const alertLines = alerts.map(a =>
    `[${ALERT_LEVEL_CFG[a.level].label}] ${a.title}\n  处置：${a.action}`
  ).join('\n')

  return [
    '【风险审核报告】',
    `患者：${patientName || '—'}   就诊号：${visitId || '—'}`,
    `当前诊断：${diagnosis || '—'}`,
    '',
    '【风险评分汇总】',
    riskLines || '（暂无数据）',
    '',
    `【风险预警（${alerts.length} 项）】`,
    alertLines || '（暂无预警）',
    '',
    `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
  ].join('\n')
}

// ══════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════

export default function RiskPage() {
  const {
    selectedDiagnosis, patientContext,
    showToast, openWritebackModal,
  } = useAppStore()

  // ── API 数据状态 ──
  const [scoreModels, setScoreModels] = useState<ScoreModel[]>([])
  const [alerts,      setAlerts]      = useState<RiskAlert[]>([])

  useEffect(() => {
    if (!patientContext || !selectedDiagnosis) return
    fetchRiskAssessment(patientContext, selectedDiagnosis)
      .then(res => {
        if (res.risk_scores?.length) {
          setScoreModels(res.risk_scores.map((rs: ApiRiskScore) => ({
            name: rs.name,
            score: rs.score,
            max: rs.max,
            level: (rs.level as RiskLevel) ?? 'moderate',
            description: rs.description,
            factors: rs.factors.map(f => ({
              name: f.name,
              value: f.value,
              contribution: (f.pts >= 15 ? 'high' : f.pts >= 8 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
            })),
          })))
        }
      })
      .catch(err => console.error('fetchRiskAssessment failed', err))
    fetchAuditAlerts(selectedDiagnosis, null, patientContext)
      .then(apiAlerts => {
        if (apiAlerts?.length) {
          setAlerts(apiAlerts.map((a: ApiAuditAlert) => ({
            id: a.id,
            category: (a.category as AlertCategory) ?? '药物安全',
            level: (a.level as AlertLevel) ?? 'info',
            title: a.title,
            detail: a.detail,
            related: a.related,
            action: a.action,
          })))
        }
      })
      .catch(err => console.error('fetchAuditAlerts failed', err))
  }, [patientContext, selectedDiagnosis])

  // ── 风险评分 & 预警状态 ──
  const [expandedModel,       setExpandedModel]       = useState<string | null>(null)
  const [expandedAlert,       setExpandedAlert]       = useState<string | null>(null)

  // ── 输出 ──
  const [confirmed,           setConfirmed]           = useState(false)
  const [saved,               setSaved]               = useState(false)
  const [summaryGenerated,    setSummaryGenerated]    = useState(false)
  const [summaryOpen,         setSummaryOpen]         = useState(false)
  const [copied,              setCopied]              = useState(false)

  const alertsByCategory = useMemo(() =>
    ALERT_CATEGORIES.reduce<Record<AlertCategory, RiskAlert[]>>((acc, cat) => {
      acc[cat] = alerts.filter(a => a.category === cat)
      return acc
    }, {} as Record<AlertCategory, RiskAlert[]>),
  [alerts])

  const criticalCount  = alerts.filter(a => a.level === 'critical').length
  const warningCount   = alerts.filter(a => a.level === 'warning').length

  const summary = useMemo(() => buildSummary(
    selectedDiagnosis,
    patientContext?.name ?? '',
    patientContext?.visit_id ?? '',
    scoreModels,
    alerts,
  ), [selectedDiagnosis, patientContext, scoreModels, alerts])

  const handleSave = () => {
    setSaved(true)
    setSummaryGenerated(true)
    setSummaryOpen(true)
    showToast('审核结果已保存', 'success')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      showToast('审核报告已复制到剪贴板', 'info')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => showToast('复制失败，请手动选取文本', 'error'))
  }

  return (
    <div className="page rk-page">

      {/* ── 页头 ── */}
      <div className="rk-header">
        <div className="rk-header-left">
          <span className="rk-page-icon">⚑</span>
          <div>
            <div className="rk-page-title">风险审核</div>
            <div className="rk-page-sub">
              药物安全 · 临床风险评估
            </div>
          </div>
        </div>
        <div className="rk-header-badges">
          {criticalCount > 0 && <span className="rk-badge-critical">{criticalCount} 严重</span>}
          {warningCount  > 0 && <span className="rk-badge-warning">{warningCount} 警告</span>}
          {confirmed && <span className="rk-badge-confirmed">✓ 已确认</span>}
        </div>
      </div>

      {/* ── 主体 ── */}
      <div className="rk-body">

        {/* ════════════════════════════
            ② 风险评分总览
            ════════════════════════════ */}
        <div className="rk-section">
          <div className="rk-sec-title">风险评分总览</div>
          <div className="rk-score-grid">
            {scoreModels.map(model => {
              const lCfg   = RISK_LEVEL_CFG[model.level]
              const isOpen = expandedModel === model.name
              const pct    = model.max ? Math.round((Number(model.score) / model.max) * 100) : null
              return (
                <div key={model.name} className={`rk-score-card ${isOpen ? 'open' : ''}`}>
                  <div className="rk-score-header" onClick={() => setExpandedModel(isOpen ? null : model.name)}>
                    <div className="rk-score-top">
                      <span className="rk-score-name">{model.name}</span>
                      <span className="rk-level-badge" style={{ color: lCfg.color, background: lCfg.bg, borderColor: lCfg.border }}>
                        {lCfg.label}
                      </span>
                    </div>
                    <div className="rk-score-row">
                      <span className="rk-score-val" style={{ color: lCfg.color }}>
                        {model.score}
                        {model.max && <span className="rk-score-max"> / {model.max}</span>}
                      </span>
                      {pct !== null && (
                        <div className="rk-score-bar-wrap">
                          <div className="rk-score-bar-fill" style={{ width: `${pct}%`, background: lCfg.border }} />
                        </div>
                      )}
                      <span className={`rk-expand-chevron ${isOpen ? 'open' : ''}`}>›</span>
                    </div>
                    <div className="rk-score-desc">{model.description}</div>
                  </div>
                  {isOpen && (
                    <div className="rk-score-detail">
                      <div className="rk-detail-label">评分因子</div>
                      <div className="rk-factor-list">
                        {model.factors.map(f => (
                          <div key={f.name} className="rk-factor-row">
                            <span className={`rk-factor-dot contrib-${f.contribution}`} />
                            <span className="rk-factor-name">{f.name}</span>
                            <span className="rk-factor-val">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ════════════════════════════
            ③ 分类风险预警
            ════════════════════════════ */}
        {ALERT_CATEGORIES.map(cat => {
          const alerts = alertsByCategory[cat]
          if (alerts.length === 0) return null
          const maxLevel = alerts.some(a => a.level === 'critical') ? 'critical'
            : alerts.some(a => a.level === 'warning') ? 'warning'
            : alerts.some(a => a.level === 'caution') ? 'caution' : 'info'
          const catCfg = ALERT_LEVEL_CFG[maxLevel]
          return (
            <div key={cat} className="rk-section">
              <div className="rk-sec-title">
                <span className="rk-cat-icon">{CATEGORY_ICONS[cat]}</span>
                {cat}
                <span className="rk-count-badge" style={{ color: catCfg.color, background: catCfg.bg, borderColor: catCfg.border }}>
                  {alerts.length} 项
                </span>
              </div>
              <div className="rk-alert-list">
                {alerts.map(alert => {
                  const aCfg2  = ALERT_LEVEL_CFG[alert.level]
                  const isOpen = expandedAlert === alert.id
                  return (
                    <div key={alert.id} className={`rk-alert-row ${isOpen ? 'open' : ''}`} style={{ borderColor: aCfg2.border, background: aCfg2.bg }}>
                      <div className="rk-alert-main" onClick={() => setExpandedAlert(isOpen ? null : alert.id)}>
                        <span className="rk-alert-icon">{aCfg2.icon}</span>
                        <div className="rk-alert-content">
                          <span className="rk-alert-level-tag" style={{ color: aCfg2.color }}>{aCfg2.label}</span>
                          <span className="rk-alert-title" style={{ color: aCfg2.color }}>{alert.title}</span>
                        </div>
                        <span className={`rk-expand-chevron ${isOpen ? 'open' : ''}`} style={{ color: aCfg2.color }}>›</span>
                      </div>
                      {isOpen && (
                        <div className="rk-alert-detail">
                          <p className="rk-alert-detail-text">{alert.detail}</p>
                          <div className="rk-alert-related">
                            {alert.related.map(r => <span key={r} className="rk-related-tag">{r}</span>)}
                          </div>
                          <div className="rk-alert-action">→ {alert.action}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ════════════════════════════
            ⑤ 审核摘要
            ════════════════════════════ */}
        <div className="rk-section rk-summary-section">
          <div className="rk-summary-header">
            <div className="rk-sec-title" style={{ margin: 0 }}>审核摘要</div>
            {!summaryGenerated ? (
              <button className="rk-btn-generate" onClick={() => { setSummaryGenerated(true); setSummaryOpen(true) }}>
                生成审核摘要
              </button>
            ) : (
              <button className="rk-btn-toggle" onClick={() => setSummaryOpen(v => !v)}>
                {summaryOpen ? '收起' : '展开'}
              </button>
            )}
          </div>
          {summaryGenerated && summaryOpen && (
            <>
              <pre className="rk-summary-text">{summary}</pre>
              <div className="rk-summary-actions">
                <button className="rk-btn-copy" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '复制摘要'}
                </button>
                <button className="rk-btn-writeback" onClick={openWritebackModal}>
                  回写 HIS
                </button>
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════
            ⑥ 输出操作
            ════════════════════════════ */}
        <div className="rk-action-section">
          {confirmed ? (
            <div className="rk-confirmed-bar">
              <span className="rk-confirmed-check">✓</span>
              <span>已确认查看本次风险审核</span>
              {saved && <span className="rk-saved-tag">已保存</span>}
              <button className="rk-btn-ghost-sm" onClick={() => setConfirmed(false)}>取消确认</button>
            </div>
          ) : (
            <div className="rk-action-row">
              <button className="rk-btn-confirm" onClick={() => { setConfirmed(true); showToast('已确认查看风险审核', 'success') }}>
                确认已查看
              </button>
              <button className="rk-btn-save" onClick={handleSave}>
                保存审核结果
              </button>
              <button className="rk-btn-writeback-main" onClick={openWritebackModal}>
                回写 HIS
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
