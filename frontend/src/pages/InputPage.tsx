import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { ParsedEntity, EntityCategory } from '../types'
import './common.css'
import './InputPage.css'

const CATEGORIES = ['症状', '体征', '疾病', '检查', '风险'] as unknown as EntityCategory[]

const MOCK_PARSED: ParsedEntity[] = [
  { id: 'e1', text: '胸闷', category: CATEGORIES[0], source: '主诉' as ParsedEntity['source'], confirmed: false },
  { id: 'e2', text: '气短', category: CATEGORIES[0], source: '主诉' as ParsedEntity['source'], confirmed: false },
  { id: 'e3', text: '心悸', category: CATEGORIES[0], source: '主诉' as ParsedEntity['source'], confirmed: false },
  { id: 'e4', text: '乏力', category: CATEGORIES[0], source: '现病史' as ParsedEntity['source'], confirmed: false },
  { id: 'e5', text: '血压控制欠佳', category: CATEGORIES[1], source: '现病史' as ParsedEntity['source'], confirmed: false },
  { id: 'e6', text: '血糖控制不佳', category: CATEGORIES[4], source: '现病史' as ParsedEntity['source'], confirmed: false },
  { id: 'e7', text: '高血压', category: CATEGORIES[2], source: '既往史' as ParsedEntity['source'], confirmed: true },
  { id: 'e8', text: '糖尿病', category: CATEGORIES[2], source: '既往史' as ParsedEntity['source'], confirmed: true },
  { id: 'e9', text: '冠脉狭窄 50%', category: CATEGORIES[3], source: '既往史' as ParsedEntity['source'], confirmed: true },
  { id: 'e10', text: '青霉素过敏', category: CATEGORIES[4], source: '既往史' as ParsedEntity['source'], confirmed: true }
]

const CATEGORY_COLORS: Record<string, string> = {
  [CATEGORIES[0]]: '#3498db',
  [CATEGORIES[1]]: '#2ecc71',
  [CATEGORIES[2]]: '#e74c3c',
  [CATEGORIES[3]]: '#f39c12',
  [CATEGORIES[4]]: '#9b59b6'
}

export default function InputPage() {
  const { parsedEntities, setParsedEntities, toggleEntityConfirm, removeEntity, addEntity, updateEntityCategory } = useAppStore()
  const [addText, setAddText] = useState('')
  const [addCategory, setAddCategory] = useState<EntityCategory>(CATEGORIES[0])

  useEffect(() => {
    if (parsedEntities.length === 0) {
      setParsedEntities(MOCK_PARSED)
    }
  }, [parsedEntities.length, setParsedEntities])

  const handleAdd = () => {
    if (!addText.trim()) {
      return
    }

    addEntity({
      id: `manual-${Date.now()}`,
      text: addText.trim(),
      category: addCategory,
      source: '补充' as ParsedEntity['source'],
      confirmed: true
    })
    setAddText('')
  }

  const cycleCategory = (id: string, current: EntityCategory) => {
    const index = CATEGORIES.indexOf(current)
    const nextCategory = CATEGORIES[(index + 1) % CATEGORIES.length]
    updateEntityCategory(id, nextCategory)
  }

  const confirmedCount = parsedEntities.filter(entity => entity.confirmed).length
  const sourceSummary = useMemo(() => {
    const sourceMap = new Map<string, number>()
    parsedEntities.forEach(entity => {
      sourceMap.set(entity.source, (sourceMap.get(entity.source) ?? 0) + 1)
    })
    return Array.from(sourceMap.entries()).map(([source, count]) => `${source} ${count} 条`)
  }, [parsedEntities])

  return (
    <div className="page">
      <div className="section">
        <div className="section-title">来源摘要</div>
        <div className="context-note">HIS 上下文仅作为后台输入来源，不在前台复刻原始文本。</div>
        <div className="source-tag-list">
          {sourceSummary.map(item => (
            <span key={item} className="source-tag">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          解析结果
          <span className="entity-count">
            {confirmedCount}/{parsedEntities.length} 已确认
          </span>
        </div>
        <div className="entity-list">
          {parsedEntities.map(entity => (
            <div key={entity.id} className={`entity-row ${entity.confirmed ? 'confirmed' : ''}`}>
              <span
                className="entity-cat"
                style={{ background: CATEGORY_COLORS[entity.category] ?? '#3498db' }}
                onClick={() => cycleCategory(entity.id, entity.category)}
                title="点击切换分类"
              >
                {entity.category}
              </span>
              <span className="entity-text">{entity.text}</span>
              <span className="entity-source">{entity.source}</span>
              <button
                className={`entity-btn ${entity.confirmed ? 'btn-confirmed' : 'btn-unconfirmed'}`}
                onClick={() => toggleEntityConfirm(entity.id)}
                title={entity.confirmed ? '取消确认' : '确认'}
              >
                {entity.confirmed ? '✓' : '○'}
              </button>
              <button className="entity-btn btn-remove" onClick={() => removeEntity(entity.id)} title="删除">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">补充输入</div>
        <div className="add-row">
          <select value={addCategory} onChange={event => setAddCategory(event.target.value as EntityCategory)}>
            {CATEGORIES.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="输入补充信息..."
            value={addText}
            onChange={event => setAddText(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd}>添加</button>
        </div>
      </div>
    </div>
  )
}
