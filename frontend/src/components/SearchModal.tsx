import { useAppStore } from '../store'
import './SearchModal.css'

const HOT_TERMS = ['冠心病', '高血压', '阿司匹林', '糖尿病', 'hs-cTnI', '心衰', '房颤']

const TYPE_COLOR: Record<string, string> = {
  '指南': '#2980b9',
  '药物': '#27ae60',
  '疾病': '#e67e22',
  '检验': '#8e44ad',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSearch: (kw: string) => void  // 由 TopBar 传入，统一执行搜索
}

export default function SearchModal({ isOpen, onClose, onSearch }: Props) {
  const {
    searchCategory, searchKeyword, setSearchKeyword,
    searchHistory, clearSearchHistory,
    searchResults, searchStatus,
    selectedResult, setSelectedResult,
    resetSearch,
  } = useAppStore()

  if (!isOpen) return null

  const handleQuick = (kw: string) => {
    setSearchKeyword(kw)
    onSearch(kw)
  }

  const handleClose = () => {
    onClose()
  }

  const handleClearAll = () => {
    resetSearch()
    onClose()
  }

  return (
    <div className="sm-overlay" onClick={handleClose}>
      <div className="sm-panel" onClick={e => e.stopPropagation()}>

        {/* ── 头部 ── */}
        <div className="sm-header">
          <span className="sm-breadcrumb">
            <span className="sm-cat-label">{searchCategory}</span>
            {searchKeyword && (
              <>
                <span className="sm-arrow"> › </span>
                <span className="sm-kw">"{searchKeyword}"</span>
              </>
            )}
            {searchStatus === 'done' && (
              <span className="sm-count">&nbsp;· {searchResults.length} 条结果</span>
            )}
          </span>
          <div className="sm-header-actions">
            {searchKeyword && (
              <button className="sm-btn-ghost" onClick={handleClearAll}>清空</button>
            )}
            <button className="sm-close" onClick={handleClose}>✕</button>
          </div>
        </div>

        {/* ── 主体 ── */}
        <div className="sm-body">

          {/* 左：结果列表 */}
          <div className={`sm-list ${selectedResult ? 'sm-list-narrow' : ''}`}>

            {/* 闲置：历史 + 热门 */}
            {searchStatus === 'idle' && (
              <div className="sm-idle">
                {searchHistory.length > 0 && (
                  <div className="sm-chip-section">
                    <div className="sm-chip-label">
                      搜索历史
                      <button className="sm-btn-ghost-sm" onClick={clearSearchHistory}>清除</button>
                    </div>
                    <div className="sm-chips">
                      {searchHistory.map(h => (
                        <span key={h} className="sm-chip sm-chip-history" onClick={() => handleQuick(h)}>{h}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="sm-chip-section">
                  <div className="sm-chip-label">热门词</div>
                  <div className="sm-chips">
                    {HOT_TERMS.map(t => (
                      <span key={t} className="sm-chip sm-chip-hot" onClick={() => handleQuick(t)}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 加载 */}
            {searchStatus === 'loading' && (
              <div className="sm-status-tip">搜索中...</div>
            )}

            {/* 无结果 */}
            {searchStatus === 'done' && searchResults.length === 0 && (
              <div className="sm-status-tip">未找到与 "{searchKeyword}" 相关的结果</div>
            )}

            {/* 结果卡片 */}
            {searchStatus === 'done' && searchResults.map(item => (
              <div
                key={item.id}
                className={`sm-card ${selectedResult?.id === item.id ? 'sm-card-active' : ''}`}
                onClick={() => setSelectedResult(selectedResult?.id === item.id ? null : item)}
              >
                <div className="sm-card-top">
                  <span
                    className="sm-badge"
                    style={{ background: TYPE_COLOR[item.type] ?? '#999' }}
                  >{item.type}</span>
                  <span className="sm-card-title">{item.title}</span>
                </div>
                <p className="sm-card-summary">{item.summary}</p>
                <div className="sm-card-foot">
                  <div className="sm-tags">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="sm-tag">{tag}</span>
                    ))}
                  </div>
                  <span className="sm-meta">{item.source} · {item.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 右：详情面板 */}
          {selectedResult && (
            <div className="sm-detail">
              <div className="sm-detail-head">
                <span
                  className="sm-badge"
                  style={{ background: TYPE_COLOR[selectedResult.type] ?? '#999' }}
                >{selectedResult.type}</span>
                <strong className="sm-detail-title">{selectedResult.title}</strong>
                <button className="sm-close-sm" onClick={() => setSelectedResult(null)}>✕</button>
              </div>
              <div className="sm-detail-tags">
                {selectedResult.tags.map(tag => (
                  <span key={tag} className="sm-tag">{tag}</span>
                ))}
              </div>
              <div className="sm-detail-body">
                {selectedResult.content.split('\n').map((line, i) => {
                  if (line.startsWith('### ')) return <h4 key={i} className="sm-h4">{line.slice(4)}</h4>
                  if (line.startsWith('- '))  return <li key={i} className="sm-li">{line.slice(2)}</li>
                  if (/^\d+\./.test(line))    return <li key={i} className="sm-li">{line.replace(/^\d+\.\s*/, '')}</li>
                  if (line.trim() === '')      return <div key={i} className="sm-br" />
                  return <p key={i} className="sm-p">{line}</p>
                })}
              </div>
              <div className="sm-detail-foot">
                来源：{selectedResult.source}&ensp;·&ensp;更新：{selectedResult.updatedAt}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
