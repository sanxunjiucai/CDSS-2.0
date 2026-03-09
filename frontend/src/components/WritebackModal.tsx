import { useMemo } from 'react'
import { useAppStore } from '../store'
import { WritebackPreview, WritebackSection } from '../types'
import './WritebackModal.css'

// 从已确认的解析实体生成回写预览
function buildPreview(
  parsedEntities: ReturnType<typeof useAppStore.getState>['parsedEntities'],
  patientContext: ReturnType<typeof useAppStore.getState>['patientContext']
): WritebackPreview {
  const confirmed = parsedEntities.filter(e => e.confirmed)

  const group = (source: string) =>
    confirmed.filter(e => e.source === source).map(e => e.text).join('、') || '（无）'

  const sections: WritebackSection[] = [
    {
      field: '主诉',
      original: patientContext?.chief_complaint ?? '—',
      newValue: [
        patientContext?.chief_complaint,
        group('主诉') !== '（无）' ? `[CDSS补充] ${group('主诉')}` : ''
      ].filter(Boolean).join('；'),
      changed: group('主诉') !== '（无）',
    },
    {
      field: '现病史补充',
      original: patientContext?.present_illness ?? '—',
      newValue: group('现病史') !== '（无）'
        ? `${patientContext?.present_illness ?? ''} [CDSS] ${group('现病史')}`
        : patientContext?.present_illness ?? '—',
      changed: group('现病史') !== '（无）',
    },
    {
      field: '既往史',
      original: patientContext?.past_history ?? '—',
      newValue: group('既往史') !== '（无）'
        ? `${patientContext?.past_history ?? ''} [CDSS确认] ${group('既往史')}`
        : patientContext?.past_history ?? '—',
      changed: group('既往史') !== '（无）',
    },
    {
      field: '补充录入',
      original: '—',
      newValue: group('补充') !== '（无）' ? group('补充') : '（无新增）',
      changed: group('补充') !== '（无）',
    },
    {
      field: '过敏标记',
      original: patientContext?.allergies?.join('、') ?? '—',
      newValue: patientContext?.allergies?.join('、') ?? '—',
      changed: false,
    },
  ]

  return {
    patientId: patientContext?.patient_id ?? '',
    visitId: patientContext?.visit_id ?? '',
    sections,
    generatedAt: new Date().toLocaleString('zh-CN'),
  }
}

export default function WritebackModal() {
  const {
    writebackModalOpen, writebackStatus,
    closeWritebackModal, setWritebackStatus,
    parsedEntities, patientContext,
    showToast,
  } = useAppStore()

  const preview = useMemo(() => {
    if (!writebackModalOpen) return null
    return buildPreview(parsedEntities, patientContext)
  }, [writebackModalOpen, parsedEntities, patientContext])

  if (!writebackModalOpen || !preview) return null

  const isSubmitting = writebackStatus === 'submitting'

  const handleWriteback = () => {
    setWritebackStatus('submitting')
    // Mock 回写（后续替换为 API 调用）
    setTimeout(() => {
      const success = Math.random() > 0.15   // 85% 成功率模拟
      if (success) {
        setWritebackStatus('success')
        showToast('回写 HIS 成功，数据已同步', 'success')
        setTimeout(closeWritebackModal, 1200)
      } else {
        setWritebackStatus('error')
        showToast('回写失败：HIS 接口超时，请重试', 'error')
      }
    }, 1400)
  }

  const handleCopy = () => {
    const text = preview.sections
      .filter(s => s.changed)
      .map(s => `【${s.field}】${s.newValue}`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      showToast('已复制到剪贴板，可粘贴至病历', 'info')
    }).catch(() => {
      showToast('复制失败，请手动选取内容', 'error')
    })
  }

  return (
    <div className="wb-overlay" onClick={closeWritebackModal}>
      <div className="wb-panel" onClick={e => e.stopPropagation()}>

        {/* 头部 */}
        <div className="wb-header">
          <div className="wb-header-left">
            <span className="wb-icon">⇄</span>
            <div>
              <div className="wb-title">回写预览</div>
              <div className="wb-subtitle">
                就诊号 {preview.visitId} · 生成于 {preview.generatedAt}
              </div>
            </div>
          </div>
          <button className="wb-close" onClick={closeWritebackModal} disabled={isSubmitting}>✕</button>
        </div>

        {/* 预览表格 */}
        <div className="wb-body">
          <table className="wb-table">
            <thead>
              <tr>
                <th className="wb-col-field">HIS 字段</th>
                <th className="wb-col-orig">当前值</th>
                <th className="wb-col-new">回写内容</th>
                <th className="wb-col-status">变化</th>
              </tr>
            </thead>
            <tbody>
              {preview.sections.map(section => (
                <tr key={section.field} className={section.changed ? 'wb-row-changed' : ''}>
                  <td className="wb-field">{section.field}</td>
                  <td className="wb-orig">{section.original}</td>
                  <td className="wb-new">{section.newValue}</td>
                  <td className="wb-status">
                    {section.changed
                      ? <span className="wb-badge-changed">有更新</span>
                      : <span className="wb-badge-same">无变化</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 状态提示 */}
        {writebackStatus === 'error' && (
          <div className="wb-error-bar">
            ⚠ 回写失败，请检查 HIS 连接后重试
          </div>
        )}

        {/* 底部操作 */}
        <div className="wb-footer">
          <button className="wb-btn-ghost" onClick={closeWritebackModal} disabled={isSubmitting}>
            取消
          </button>
          <div className="wb-footer-right">
            <button className="wb-btn-copy" onClick={handleCopy} disabled={isSubmitting}>
              复制到病历
            </button>
            <button
              className={`wb-btn-submit ${isSubmitting ? 'loading' : ''}`}
              onClick={handleWriteback}
              disabled={isSubmitting}
            >
              {isSubmitting ? '回写中...' : '回写 HIS'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
