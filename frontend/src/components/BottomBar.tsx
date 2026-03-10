import { StepId } from '../types'
import './BottomBar.css'

interface Props {
  currentStep: StepId
  onSave: () => void
  onConfirmInput: () => void      // 打开回写预览 modal
  onConfirmDiagnosis: () => void
  onConfirmCommonTreatment: () => void
  onConfirmPersonalizedTreatment: () => void
  onConfirmTests: () => void
  onExportReport: () => void
  onCopyToRecord: () => void      // 复制到病历（非 input 页）
}

const PAGE_CONFIG: Record<StepId, { hint: string; primaryLabel: string; showCopy: boolean }> = {
  'input':                  { hint: '接受信息项后，将进入辅助诊断推理', primaryLabel: '确认信息并进入辅助诊断', showCopy: false },
  'diagnosis':              { hint: '选择诊断后可进入治疗方案',                 primaryLabel: '确认诊断方案',   showCopy: true  },
  'common-treatment':       { hint: '选定通用方案后可进行个性化调整',            primaryLabel: '确认通用治疗',   showCopy: true  },
  'personalized-treatment': { hint: '完成个性化调整后可推荐检验检查',            primaryLabel: '确认个性化方案', showCopy: true  },
  'tests':                  { hint: '勾选所需检查项目',                         primaryLabel: '确认检查项目',   showCopy: true  },
  'lab-results':            { hint: '查看检验结果并关注异常指标',               primaryLabel: '确认结果已阅',   showCopy: true  },
  'evidence':               { hint: '参考循证依据，辅助临床决策',               primaryLabel: '保存参考记录',   showCopy: true  },
  'assessment':             { hint: '完成功能评估，视情况发起转诊',             primaryLabel: '保存评估结果',   showCopy: true  },
  'risk':                   { hint: '核查风险与审核提示后输出报告',              primaryLabel: '输出报告',       showCopy: true  },
}

export default function BottomBar({
  currentStep, onSave,
  onConfirmInput, onConfirmDiagnosis,
  onConfirmCommonTreatment, onConfirmPersonalizedTreatment,
  onConfirmTests, onExportReport,
  onCopyToRecord,
}: Props) {
  const config = PAGE_CONFIG[currentStep]

  const handlePrimary = () => {
    switch (currentStep) {
      case 'input':                  return onConfirmInput()
      case 'diagnosis':              return onConfirmDiagnosis()
      case 'common-treatment':       return onConfirmCommonTreatment()
      case 'personalized-treatment': return onConfirmPersonalizedTreatment()
      case 'tests':                  return onConfirmTests()
      case 'lab-results':            return onExportReport()
      case 'evidence':               return onExportReport()
      case 'assessment':             return onExportReport()
      case 'risk':                   return onExportReport()
    }
  }

  return (
    <div className="bottom-bar">
      <span className="bottom-hint">{config.hint}</span>
      <div className="bottom-actions">
        <button className="btn-secondary" onClick={onSave}>保存草稿</button>
        {config.showCopy && (
          <button className="btn-copy" onClick={onCopyToRecord}>复制到病历</button>
        )}
        <button className="btn-primary" onClick={handlePrimary}>{config.primaryLabel}</button>
      </div>
    </div>
  )
}
