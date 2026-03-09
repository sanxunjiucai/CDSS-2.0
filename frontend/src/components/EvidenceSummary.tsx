import './EvidenceSummary.css'

interface Props {
  title?: string
  items: string[]
}

export default function EvidenceSummary({ title = '来源摘要', items }: Props) {
  const visibleItems = items.map(item => item.trim()).filter(Boolean).slice(0, 5)

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <div className="evidence-summary">
      <div className="evidence-summary-title">{title}</div>
      <div className="evidence-summary-list">
        {visibleItems.map((item, index) => (
          <div key={`${item}-${index}`} className="evidence-summary-item">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
