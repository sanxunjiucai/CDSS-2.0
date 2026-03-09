import { useState } from 'react'
import { useAppStore } from '../store'
import { PatientContext, SearchCategory } from '../types'
import { runSearch } from '../mock/searchData'
import SearchModal from './SearchModal'
import './TopBar.css'

const CATEGORIES: SearchCategory[] = ['全部', '指南', '药物', '疾病', '检验']

interface Props {
  patient: PatientContext | null
}

export default function TopBar({ patient }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const {
    searchCategory, setSearchCategory,
    searchKeyword, setSearchKeyword,
    setSearchResults, setSearchStatus,
    setSelectedResult, pushSearchHistory, resetSearch,
  } = useAppStore()

  const execSearch = (kw: string) => {
    const trimmed = kw.trim()
    if (!trimmed) return
    pushSearchHistory(trimmed)
    setSearchStatus('loading')
    setSelectedResult(null)
    setModalOpen(true)
    setTimeout(() => {
      setSearchResults(runSearch(trimmed, useAppStore.getState().searchCategory))
      setSearchStatus('done')
    }, 380)
  }

  const handleClear = () => {
    resetSearch()
    setModalOpen(false)
  }

  const topTag = patient?.risk_tags?.[0] ?? null

  return (
    <>
      {/* 第一行：工具栏 */}
      <div className="toolbar">
        <span className="toolbar-title">CDSS 辅助决策</span>

        <div className="toolbar-search">
          <select
            className="search-cat"
            value={searchCategory}
            onChange={e => setSearchCategory(e.target.value as SearchCategory)}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="search-divider" />
          <input
            type="text"
            placeholder="搜索指南 / 药物 / 疾病..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && execSearch(searchKeyword)}
          />
          {searchKeyword && (
            <button className="search-clear" onClick={handleClear} title="清空">✕</button>
          )}
          <button className="search-btn" onClick={() => execSearch(searchKeyword)}>查询</button>
        </div>

        <div className="toolbar-icons">
          <button className="icon-btn" title="消息提醒">🔔</button>
          <button className="icon-btn" title="关闭">✕</button>
        </div>
      </div>

      {/* 第二行：患者极简摘要 */}
      {patient && (
        <div className="patient-bar">
          <span className="pt-name">{patient.name}</span>
          <span className="pt-meta">{patient.gender} · {patient.age}岁</span>
          <span className="pt-sep" />
          <span className="pt-meta">{patient.department}</span>
          <span className="pt-sep" />
          <span className="pt-meta">{patient.visit_id}</span>
          {topTag && <span className="pt-tag">{topTag}</span>}
        </div>
      )}

      <SearchModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSearch={execSearch}
      />
    </>
  )
}
