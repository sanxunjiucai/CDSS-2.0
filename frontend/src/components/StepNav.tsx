import { StepId } from '../types'
import './StepNav.css'

interface NavItem {
  id: StepId
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'input',                  label: '辅助输入',   icon: '✎' },
  { id: 'diagnosis',              label: '辅助诊断',   icon: '⚕' },
  { id: 'common-treatment',       label: '通用治疗',   icon: '＋' },
  { id: 'personalized-treatment', label: '个性化治疗', icon: '★' },
  { id: 'tests',                  label: '检验检查',   icon: '◎' },
  { id: 'lab-results',            label: '结果解读',   icon: '📋' },
  { id: 'evidence',               label: '循证医学',   icon: '📚' },
  { id: 'assessment',             label: '评估转诊',   icon: '🔀' },
  { id: 'risk',                   label: '风险审核',   icon: '⚑' },
]

interface Props {
  currentStep: StepId
  onStepChange: (step: StepId) => void
}

export default function StepNav({ currentStep, onStepChange }: Props) {
  return (
    <nav className="nav-panel" aria-label="功能导航">
      {NAV_ITEMS.map(item => (
        <div
          key={item.id}
          className={`nav-item ${currentStep === item.id ? 'active' : ''}`}
          onClick={() => onStepChange(item.id)}
          title={item.label}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">
            {item.label.split('').map((char, i) => (
              <span key={i}>{char}</span>
            ))}
          </span>
        </div>
      ))}
    </nav>
  )
}
